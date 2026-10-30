import { app, Notification, shell } from 'electron'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { z } from 'zod'
import type { ApprovedApp } from '@shared/ipc'
import { createScopedFiles } from './files'
import { appIcon } from '../icon'
import { tool, type Plugin } from './types'

export function filesPlugin(folders: () => string[]): Plugin {
  const files = createScopedFiles(folders)
  return {
    id: 'core.files',
    name: 'Files',
    version: '1.0.0',
    description: 'Search and read text files in folders you approve. Read-only.',
    permissions: ['files.read'],
    tools: [
      tool({
        name: 'files_search',
        description: 'Search the user’s approved folders for files whose name or text contains all the words in the query.',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string', description: 'Words to look for, e.g. "resume" or "invoice march"' } },
          required: ['query']
        },
        input: z.object({ query: z.string().trim().min(1).max(200) }),
        risk: 'read',
        describe: ({ query }) => `Searched your folders for “${query}”`,
        async run({ query }, signal) {
          if (!folders().length) return 'No folders are approved yet. Ask the user to add one in Settings → Tools.'
          const { hits, scanned, truncated } = await files.search(query, signal)
          if (!hits.length) return `No matches in ${scanned} files.`
          return [
            `${hits.length} match${hits.length === 1 ? '' : 'es'}${truncated ? ' (search stopped early; there may be more)' : ''}:`,
            ...hits.map((h) => (h.line ? `${h.path}:${h.line}: ${h.text}` : h.path))
          ].join('\n')
        }
      }),
      tool({
        name: 'files_read',
        description: 'Read a text file from the user’s approved folders (path from files_search, or relative to an approved folder).',
        parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
        input: z.object({ path: z.string().trim().min(1).max(1000) }),
        risk: 'read',
        describe: ({ path }) => `Read ${basename(path)}`,
        async run({ path }) {
          const { path: real, text, truncated } = await files.read(path)
          return `${real}${truncated ? ' (first 200 KB)' : ''}\n\n${text.slice(0, 20_000)}`
        }
      })
    ]
  }
}

/** Windows' own apps, always on the list (opening them runs nothing by itself). */
export function systemApps(): ApprovedApp[] {
  const win = process.env['SystemRoot'] ?? 'C:\\Windows'
  const local = process.env['LOCALAPPDATA'] ?? ''
  return [
    { name: 'Notepad', path: join(win, 'System32', 'notepad.exe') },
    { name: 'Calculator', path: join(win, 'System32', 'calc.exe') },
    { name: 'Paint', path: join(win, 'System32', 'mspaint.exe') },
    { name: 'File Explorer', path: join(win, 'explorer.exe') },
    { name: 'Terminal', path: join(local, 'Microsoft', 'WindowsApps', 'wt.exe') },
    { name: 'Command Prompt', path: join(win, 'System32', 'cmd.exe') }
  ].filter((a) => existsSync(a.path))
}

/** A note title as a safe file name (no characters Windows forbids, no control characters). */
export const noteFileName = (title: string): string =>
  // eslint-disable-next-line no-control-regex
  `${title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').replace(/[. ]+$/, '').trim().slice(0, 80) || 'Note'}.txt`

/** Writing: notes into Documents\\Lumi Notes (opened in Notepad), and text/code files in approved folders (backed up first). */
export function writePlugin(folders: () => string[], backupDir: () => string): Plugin {
  const files = createScopedFiles(folders)
  return {
    id: 'core.write',
    name: 'Writing',
    version: '1.0.0',
    description: 'Write notes (opened in Notepad) and create or edit text and code files in approved folders. Asks first; edits are backed up.',
    permissions: ['files.write'],
    tools: [
      tool({
        name: 'note_write',
        description: 'Write a note or any text for the user and open it in Notepad (saved in Documents\\Lumi Notes).',
        parameters: {
          type: 'object',
          properties: { title: { type: 'string', description: 'Short file title' }, text: { type: 'string', description: 'The full text to write' } },
          required: ['title', 'text']
        },
        input: z.object({ title: z.string().trim().min(1).max(120), text: z.string().max(200_000) }),
        risk: 'act',
        describe: ({ title, text }) => `Write “${noteFileName(title)}” (${text.split('\n').length} lines) and open it in Notepad`,
        async run({ title, text }) {
          const dir = join(app.getPath('documents'), 'Lumi Notes')
          await mkdir(dir, { recursive: true })
          const file = join(dir, noteFileName(title))
          await writeFile(file, text, 'utf8')
          const error = await shell.openPath(file)
          return error ? `Saved ${file}, but Windows could not open it: ${error}` : `Saved and opened ${file}.`
        }
      }),
      tool({
        name: 'files_write',
        description:
          'Create a text/code file, or replace one with new full contents, inside the user’s approved folders. Read it first with files_read, then send the complete new text.',
        parameters: {
          type: 'object',
          properties: { path: { type: 'string', description: 'Path from files_search, or relative to an approved folder' }, content: { type: 'string' } },
          required: ['path', 'content']
        },
        input: z.object({ path: z.string().trim().min(1).max(1000), content: z.string().max(1024 * 1024) }),
        risk: 'act',
        describe: ({ path, content }) => `Write ${basename(path)} (${content.split('\n').length} lines). The old version is backed up.`,
        async run({ path, content }) {
          const r = await files.write(path, content, backupDir())
          return r.created ? `Created ${r.path}.` : `Saved ${r.path}. The previous version is at ${r.backup}.`
        }
      })
    ]
  }
}

/** Matches a spoken or typed app name against the allow-list ("vs code" → "Visual Studio Code"). */
export function findApp(apps: ApprovedApp[], name: string): ApprovedApp | undefined {
  const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const want = norm(name)
  if (!want) return undefined
  return (
    apps.find((a) => norm(a.name) === want) ??
    apps.find((a) => norm(a.name).includes(want) || want.includes(norm(a.name))) ??
    apps.find((a) => norm(basename(a.path)).includes(want))
  )
}

/** The user's own folders, always openable by name. */
export function knownFolders(): ApprovedApp[] {
  const names = { Downloads: 'downloads', Documents: 'documents', Desktop: 'desktop', Pictures: 'pictures', Music: 'music', Videos: 'videos' } as const
  return Object.entries(names).map(([name, key]) => ({ name, path: app.getPath(key) }))
}

/** An app from the Start menu: its name and shell id (opened through Windows, never as a command line). */
export interface InstalledApp {
  name: string
  id: string
}

export function appsPlugin(apps: () => ApprovedApp[], installed?: { list(): Promise<InstalledApp[]>; launch(id: string): Promise<void> }): Plugin {
  return {
    id: 'core.apps',
    name: 'Apps and folders',
    version: '1.1.0',
    description: 'Open any app installed on this PC (as in the Start menu) and your folders, by name.',
    permissions: ['apps.launch'],
    tools: [
      tool({
        name: 'apps_open',
        description:
          'Open any app installed on this PC by name (anything in the Start menu: browsers, Spotify, Discord, Steam, Settings, Notepad, Terminal…) ' +
          'or a folder (Downloads, Documents, Desktop, Pictures, Music, Videos).',
        parameters: {
          type: 'object',
          properties: { name: { type: 'string', description: 'The app or folder, e.g. "Spotify", "Chrome", "Downloads"' } },
          required: ['name']
        },
        input: z.object({ name: z.string().trim().min(1).max(120) }),
        risk: 'act',
        describe: ({ name }) => `Open ${findApp(apps(), name)?.name ?? name}`,
        async run({ name }) {
          // Say what can happen next: small models otherwise stop here and tell the user to do the rest.
          const next = 'it is now the window in front. To type into it, call ui_type with the text (no item needed); to see it, call screen_look.'
          const own = findApp(apps(), name)
          if (own) {
            // No arguments and no shell: only the exact path is opened.
            const error = await shell.openPath(own.path)
            if (error) throw new Error(`Windows could not open ${own.name}: ${error}`)
            return `Opened ${own.name}; ${next}`
          }
          const list = (await installed?.list()) ?? []
          const hit = findApp(list.map((a) => ({ name: a.name, path: a.id })), name)
          if (!hit) throw new Error(`No installed app is called “${name}”. Installed: ${list.map((a) => a.name).slice(0, 60).join(', ')}.`)
          await installed!.launch(hit.path)
          return `Opened ${hit.name}; ${next}`
        }
      })
    ]
  }
}

export function notifyPlugin(enabled: () => boolean): Plugin {
  return {
    id: 'core.notify',
    name: 'Notifications',
    version: '1.0.0',
    description: 'Show Windows notifications (reminders, results).',
    permissions: ['notify'],
    tools: [
      tool({
        name: 'notify_user',
        description: 'Show the user a short Windows notification.',
        parameters: {
          type: 'object',
          properties: { title: { type: 'string' }, message: { type: 'string' } },
          required: ['title', 'message']
        },
        input: z.object({ title: z.string().trim().min(1).max(80), message: z.string().trim().max(300) }),
        risk: 'read',
        describe: ({ title }) => `Notified you: ${title}`,
        async run({ title, message }) {
          if (!enabled()) return 'Notifications are turned off in Settings.'
          new Notification({ title, body: message, icon: appIcon() }).show()
          return 'Notification shown.'
        }
      })
    ]
  }
}
