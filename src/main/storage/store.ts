import { existsSync, renameSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import type { ConversationSummary, MemoryItem, MemoryKind } from '@shared/ipc'

// SQLite via Node's built-in node:sqlite (no native module to rebuild for Electron).

const MIGRATIONS = [
  `CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
   CREATE TABLE conversations (id INTEGER PRIMARY KEY, started_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
   CREATE TABLE messages (
     id INTEGER PRIMARY KEY,
     conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
     role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
     text TEXT NOT NULL,
     created_at INTEGER NOT NULL
   );
   CREATE INDEX messages_by_conversation ON messages(conversation_id, id);
   CREATE TABLE memories (
     id INTEGER PRIMARY KEY,
     kind TEXT NOT NULL CHECK (kind IN ('memory', 'note')),
     text TEXT NOT NULL,
     created_at INTEGER NOT NULL
   );`
]

export interface StoredMessage {
  role: 'user' | 'assistant'
  text: string
}

export type Store = ReturnType<typeof createStore>

/** Opens (or creates) the database. A file that cannot be opened is set aside, never deleted. */
export function openStore(file: string, now: () => number = Date.now): Store {
  let db: DatabaseSync | undefined
  try {
    db = new DatabaseSync(file)
    return createStore(db, now)
  } catch (error) {
    // Opening succeeds even for a non-database file; the first query fails. Close it, or Windows refuses the rename.
    if (db?.isOpen) db.close()
    if (file === ':memory:' || !existsSync(file)) throw error
    const aside = `${file}.unreadable-${now()}`
    renameSync(file, aside)
    console.error(`Database could not be opened; kept it as ${aside} and started a new one`, error)
    return createStore(new DatabaseSync(file), now)
  }
}

function createStore(db: DatabaseSync, now: () => number) {
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;')
  const version = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version
  if (version > MIGRATIONS.length) throw new Error(`Database is from a newer app version (schema ${version})`)
  for (let v = version; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN')
    try {
      db.exec(MIGRATIONS[v]!)
      db.exec(`PRAGMA user_version = ${v + 1}`)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }

  const q = {
    getKv: db.prepare('SELECT value FROM kv WHERE key = ?'),
    setKv: db.prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'),
    newConversation: db.prepare('INSERT INTO conversations (started_at, updated_at) VALUES (?, ?)'),
    touchConversation: db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?'),
    addMessage: db.prepare('INSERT INTO messages (conversation_id, role, text, created_at) VALUES (?, ?, ?, ?)'),
    latestConversation: db.prepare('SELECT id FROM conversations ORDER BY updated_at DESC, id DESC LIMIT 1'),
    messages: db.prepare('SELECT role, text FROM messages WHERE conversation_id = ? ORDER BY id'),
    listConversations: db.prepare(`
      SELECT c.id, c.started_at AS startedAt, c.updated_at AS updatedAt, COUNT(m.id) AS messages,
        (SELECT text FROM messages WHERE conversation_id = c.id AND role = 'user' ORDER BY id LIMIT 1) AS firstUser
      FROM conversations c LEFT JOIN messages m ON m.conversation_id = c.id
      GROUP BY c.id ORDER BY c.updated_at DESC, c.id DESC`),
    deleteConversation: db.prepare('DELETE FROM conversations WHERE id = ?'),
    deleteAllConversations: db.prepare('DELETE FROM conversations'),
    listMemories: db.prepare('SELECT id, kind, text, created_at AS createdAt FROM memories ORDER BY id DESC'),
    addMemory: db.prepare('INSERT INTO memories (kind, text, created_at) VALUES (?, ?, ?)'),
    deleteMemory: db.prepare('DELETE FROM memories WHERE id = ?'),
    deleteAllMemories: db.prepare('DELETE FROM memories')
  }

  return {
    getJson(key: string): unknown {
      const row = q.getKv.get(key) as { value: string } | undefined
      if (!row) return undefined
      try {
        return JSON.parse(row.value)
      } catch {
        return undefined
      }
    },
    setJson(key: string, value: unknown): void {
      q.setKv.run(key, JSON.stringify(value))
    },

    createConversation(): number {
      const t = now()
      return Number(q.newConversation.run(t, t).lastInsertRowid)
    },
    addMessage(conversationId: number, message: StoredMessage): void {
      const t = now()
      q.addMessage.run(conversationId, message.role, message.text, t)
      q.touchConversation.run(t, conversationId)
    },
    /** The most recently updated conversation, if any. */
    latestConversation(): { id: number; messages: StoredMessage[] } | undefined {
      const row = q.latestConversation.get() as { id: number } | undefined
      if (!row) return undefined
      return { id: row.id, messages: q.messages.all(row.id) as unknown as StoredMessage[] }
    },
    listConversations(): ConversationSummary[] {
      return (q.listConversations.all() as unknown as (Omit<ConversationSummary, 'title'> & { firstUser: string | null })[]).map(
        ({ firstUser, ...c }) => ({ ...c, title: firstUser ? firstUser.slice(0, 80) : '(no messages)' })
      )
    },
    deleteConversation(id: number): void {
      q.deleteConversation.run(id)
    },
    deleteAllConversations(): void {
      q.deleteAllConversations.run()
    },

    listMemories(): MemoryItem[] {
      return q.listMemories.all() as unknown as MemoryItem[]
    },
    addMemory(kind: MemoryKind, text: string): number {
      return Number(q.addMemory.run(kind, text, now()).lastInsertRowid)
    },
    deleteMemory(id: number): void {
      q.deleteMemory.run(id)
    },
    deleteAllMemories(): void {
      q.deleteAllMemories.run()
    },

    close(): void {
      db.close()
    }
  }
}
