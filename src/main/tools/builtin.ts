import { Notification, shell } from 'electron'
import { basename } from 'node:path'
import { z } from 'zod'
import type { ApprovedApp } from '@shared/ipc'
import { createScopedFiles } from './files'
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

export function appsPlugin(apps: () => ApprovedApp[]): Plugin {
  return {
    id: 'core.apps',
    name: 'Apps and folders',
    version: '1.0.0',
    description: 'Open apps and folders from your allow-list. Asks you first, every time (or once per chat).',
    permissions: ['apps.launch'],
    tools: [
      tool({
        name: 'apps_open',
        description: 'Open an app or folder the user has approved. Only names from the approved list work.',
        // A getter, so the model always sees the current allow-list.
        get parameters() {
          return {
            type: 'object',
            properties: { name: { type: 'string', description: `One of: ${apps().map((a) => a.name).join(', ') || '(none approved yet)'}` } },
            required: ['name']
          }
        },
        input: z.object({ name: z.string().trim().min(1).max(120) }),
        risk: 'act',
        describe: ({ name }) => `Open ${findApp(apps(), name)?.name ?? name}`,
        check: ({ name }) =>
          findApp(apps(), name)
            ? null
            : `“${name}” is not on the approved list. Approved: ${apps().map((a) => a.name).join(', ') || 'none yet'}. The user can add it in Settings → Tools.`,
        async run({ name }) {
          const app = findApp(apps(), name)!
          // No arguments and no shell: only the exact approved path is opened.
          const error = await shell.openPath(app.path)
          if (error) throw new Error(`Windows could not open ${app.name}: ${error}`)
          return `Opened ${app.name}.`
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
          new Notification({ title, body: message }).show()
          return 'Notification shown.'
        }
      })
    ]
  }
}
