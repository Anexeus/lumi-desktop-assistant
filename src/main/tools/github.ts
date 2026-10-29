import { z } from 'zod'
import { tool, type Plugin } from './types'

// Read-only GitHub. Works without a token for public data (60 requests/hour); a read-only
// fine-grained token raises the limit and adds the user's private repos.

const repoSchema = z.string().trim().regex(/^[\w.-]+\/[\w.-]+$/, 'Use owner/name, e.g. microsoft/vscode')

export function githubPlugin(token: () => Promise<string | undefined>, fetchImpl: typeof fetch = fetch): Plugin {
  async function api<T>(path: string, signal: AbortSignal): Promise<T> {
    const key = await token()
    const res = await fetchImpl(`https://api.github.com${path}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Lumi-Desktop-Assistant',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(key ? { Authorization: `Bearer ${key}` } : {})
      },
      signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)])
    })
    if (res.status === 404) throw new Error('Not found (or private and no token is set).')
    if (res.status === 401) throw new Error('GitHub rejected the token. Check it in Settings → Integrations.')
    if (res.status === 403 || res.status === 429) throw new Error('GitHub rate limit reached. Add a read-only token in Settings → Integrations, or try later.')
    if (!res.ok) throw new Error(`GitHub returned ${res.status}.`)
    return (await res.json()) as T
  }

  type Repo = { full_name: string; description: string | null; stargazers_count: number; open_issues_count: number; language: string | null; html_url: string; pushed_at: string; default_branch: string; license?: { spdx_id?: string } | null }
  type Issue = { number: number; title: string; state: string; user?: { login?: string }; comments: number; html_url: string; pull_request?: unknown; body?: string | null; created_at: string }
  const repoLine = (r: Repo): string =>
    `${r.full_name} ★${r.stargazers_count} ${r.language ?? ''} ${r.license?.spdx_id ?? ''}\n  ${(r.description ?? '').slice(0, 200)}\n  ${r.html_url}`

  return {
    id: 'core.github',
    name: 'GitHub',
    version: '1.0.0',
    description: 'Look up repositories, issues and pull requests (read-only).',
    permissions: ['github.read'],
    tools: [
      tool({
        name: 'github_search_repos',
        description: 'Search GitHub repositories.',
        parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
        input: z.object({ query: z.string().trim().min(1).max(200) }),
        risk: 'read',
        describe: ({ query }) => `Searched GitHub for “${query}”`,
        async run({ query }, signal) {
          const r = await api<{ items: Repo[] }>(`/search/repositories?q=${encodeURIComponent(query)}&per_page=8`, signal)
          return r.items.length ? r.items.map(repoLine).join('\n') : 'No repositories found.'
        }
      }),
      tool({
        name: 'github_repo',
        description: 'Details of one GitHub repository (owner/name).',
        parameters: { type: 'object', properties: { repo: { type: 'string', description: 'owner/name' } }, required: ['repo'] },
        input: z.object({ repo: repoSchema }),
        risk: 'read',
        describe: ({ repo }) => `Looked up ${repo} on GitHub`,
        async run({ repo }, signal) {
          const r = await api<Repo>(`/repos/${repo}`, signal)
          return `${repoLine(r)}\n  open issues + PRs: ${r.open_issues_count}, default branch: ${r.default_branch}, last push: ${r.pushed_at}`
        }
      }),
      tool({
        name: 'github_issues',
        description: 'List issues and pull requests of a repository.',
        parameters: {
          type: 'object',
          properties: { repo: { type: 'string', description: 'owner/name' }, state: { type: 'string', enum: ['open', 'closed', 'all'] } },
          required: ['repo']
        },
        input: z.object({ repo: repoSchema, state: z.enum(['open', 'closed', 'all']).default('open') }),
        risk: 'read',
        describe: ({ repo, state }) => `Listed ${state} issues of ${repo}`,
        async run({ repo, state }, signal) {
          const list = await api<Issue[]>(`/repos/${repo}/issues?state=${state}&per_page=15`, signal)
          if (!list.length) return `No ${state} issues.`
          return list.map((i) => `#${i.number} ${i.pull_request ? '[PR] ' : ''}${i.title} (${i.state}, ${i.comments} comments, by ${i.user?.login ?? '?'})`).join('\n')
        }
      }),
      tool({
        name: 'github_issue',
        description: 'Read one issue or pull request with its description.',
        parameters: {
          type: 'object',
          properties: { repo: { type: 'string', description: 'owner/name' }, number: { type: 'number' } },
          required: ['repo', 'number']
        },
        input: z.object({ repo: repoSchema, number: z.number().int().positive() }),
        risk: 'read',
        describe: ({ repo, number }) => `Read ${repo}#${number}`,
        async run({ repo, number }, signal) {
          const i = await api<Issue>(`/repos/${repo}/issues/${number}`, signal)
          return `#${i.number} ${i.title} (${i.state}) by ${i.user?.login ?? '?'} on ${i.created_at}\n${i.html_url}\n\n${(i.body ?? '').slice(0, 8000)}`
        }
      })
    ]
  }
}
