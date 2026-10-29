import { describe, expect, it } from 'vitest'
import { githubPlugin } from '../../src/main/tools/github'

const signal = new AbortController().signal

function fake(status: number, body: unknown) {
  const calls: { url: string; headers: Record<string, string> }[] = []
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, headers: init.headers as Record<string, string> })
    return new Response(JSON.stringify(body), { status })
  }) as unknown as typeof fetch
  return { impl, calls }
}

describe('github plugin', () => {
  it('searches repositories, sending the token only when one is set', async () => {
    const { impl, calls } = fake(200, { items: [{ full_name: 'a/b', description: 'd', stargazers_count: 5, html_url: 'https://github.com/a/b', language: 'TS' }] })
    const search = githubPlugin(async () => 'tok', impl).tools.find((t) => t.name === 'github_search_repos')!
    expect(await search.run({ query: 'electron vrm' }, signal)).toContain('a/b ★5')
    expect(calls[0]!.url).toBe('https://api.github.com/search/repositories?q=electron%20vrm&per_page=8')
    expect(calls[0]!.headers['Authorization']).toBe('Bearer tok')

    const anon = fake(200, { items: [] })
    await githubPlugin(async () => undefined, anon.impl).tools[0]!.run({ query: 'x' }, signal)
    expect(anon.calls[0]!.headers['Authorization']).toBeUndefined()
  })

  it('validates repo names and explains rate limits', async () => {
    const repo = githubPlugin(async () => undefined, fake(403, {}).impl).tools.find((t) => t.name === 'github_repo')!
    expect(repo.input.safeParse({ repo: '../../etc' }).success).toBe(false)
    expect(repo.input.safeParse({ repo: 'microsoft/vscode' }).success).toBe(true)
    await expect(repo.run({ repo: 'microsoft/vscode' }, signal)).rejects.toThrow(/rate limit/)
  })
})
