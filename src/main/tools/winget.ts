// Installing apps with Windows' package manager (winget). The model names an app; Lumi searches winget's catalog and
// installs the package id winget itself reports, silently. winget is a fixed program run with an argument list: no shell.
import { execFile } from 'node:child_process'
import { z } from 'zod'
import { tool, type Plugin } from './types'

const SEARCH_TIMEOUT_MS = 60_000
const INSTALL_TIMEOUT_MS = 15 * 60_000

/** The first package listed by `winget search`: its name and id. Columns are found from the header line. */
export function parseWingetSearch(output: string): { name: string; id: string } | null {
  // winget redraws a spinner with carriage returns; keep what was written last on each line.
  const lines = output.split(/\r?\n/).map((l) => l.slice(l.lastIndexOf('\r') + 1))
  const rule = lines.findIndex((l) => /^-{10,}/.test(l.trim()))
  if (rule < 1) return null
  const header = lines[rule - 1]!
  const idAt = header.indexOf('Id')
  const versionAt = header.indexOf('Version')
  if (idAt < 1 || versionAt <= idAt) return null
  for (const line of lines.slice(rule + 1)) {
    const name = line.slice(0, idAt).trim()
    const id = line.slice(idAt, versionAt).trim()
    if (name && /^[\w.+-]+$/.test(id)) return { name, id }
  }
  return null
}

const lastLine = (out: string): string => out.trim().split(/\r?\n/).filter(Boolean).at(-1)?.slice(-200) ?? 'no output'

const winget = (args: string[], timeout: number): Promise<{ code: number; out: string }> =>
  new Promise((resolve) => {
    execFile('winget', args, { timeout, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) =>
      resolve({ code: error ? (typeof error.code === 'number' ? error.code : 1) : 0, out: `${stdout}${stderr}` })
    )
  })

export function wingetPlugin(): Plugin {
  return {
    id: 'core.install',
    name: 'Install apps',
    version: '1.0.0',
    description: 'Install apps with Windows’ package manager (winget).',
    permissions: ['apps.install'],
    tools: [
      tool({
        name: 'app_install',
        description: 'Install an app on this PC with Windows’ package manager (winget), e.g. "Visual Studio Code", "VLC", "Discord". Takes a minute or more.',
        parameters: { type: 'object', properties: { name: { type: 'string', description: 'The app to install' } }, required: ['name'] },
        input: z.object({ name: z.string().trim().min(2).max(100) }),
        risk: 'act',
        describe: ({ name }) => `Install ${name} with winget`,
        async run({ name }) {
          const search = await winget(['search', '--name', name, '-s', 'winget', '--accept-source-agreements'], SEARCH_TIMEOUT_MS)
          const pkg = parseWingetSearch(search.out)
          if (!pkg) {
            if (search.code !== 0 && /source|0x8a15/i.test(search.out)) {
              throw new Error(
                `Windows’ package manager (winget) is not working on this PC (${lastLine(search.out)}). Tell the user to update ` +
                  '"App Installer" from the Microsoft Store, or run "winget source reset --force" in an administrator terminal.'
              )
            }
            throw new Error(`winget found no app called “${name}”.`)
          }
          const install = await winget(['install', '--id', pkg.id, '-e', '--silent', '--accept-package-agreements', '--accept-source-agreements'], INSTALL_TIMEOUT_MS)
          if (install.code !== 0) throw new Error(`winget could not install ${pkg.name}: ${lastLine(install.out)}`)
          return `Installed ${pkg.name} (${pkg.id}). It is in the Start menu now; open it with apps_open.`
        }
      })
    ]
  }
}
