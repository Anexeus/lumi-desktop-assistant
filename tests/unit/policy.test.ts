import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PROD_CSP, devCsp, isTrustedUrl, resolveBundlePath } from '../../src/main/policy'

describe('isTrustedUrl', () => {
  const dev = 'http://localhost:5173'

  it('trusts the app bundle and the local dev server', () => {
    expect(isTrustedUrl('app://bundle/chat.html', undefined)).toBe(true)
    expect(isTrustedUrl('http://localhost:5173/chat.html', dev)).toBe(true)
  })

  it('rejects everything else', () => {
    for (const url of [
      'app://evil/chat.html',
      'https://example.com/',
      'http://localhost:5174/',
      'file:///C:/Windows/system32/',
      'devtools://devtools/',
      'not a url'
    ]) {
      expect(isTrustedUrl(url, dev), url).toBe(false)
    }
  })

  it('never trusts a non-loopback dev origin', () => {
    expect(isTrustedUrl('http://example.com/chat.html', 'http://example.com')).toBe(false)
  })

  it('rejects dev URLs when not in dev', () => {
    expect(isTrustedUrl('http://localhost:5173/chat.html', undefined)).toBe(false)
  })
})

describe('resolveBundlePath', () => {
  const root = resolve('out/renderer')

  it('maps normal paths under the root', () => {
    expect(resolveBundlePath(root, '/chat.html')).toBe(join(root, 'chat.html'))
    expect(resolveBundlePath(root, '/assets/a%20b.js')).toBe(join(root, 'assets', 'a b.js'))
  })

  it('blocks traversal and odd encodings', () => {
    for (const p of [
      '/../package.json',
      '/assets/../../main/index.js',
      '/%2e%2e/package.json',
      '/..%2fpackage.json',
      '/..%5cpackage.json',
      '/C:/Windows/win.ini',
      '/%00chat.html',
      '/%E0%A4%A'
    ]) {
      expect(resolveBundlePath(root, p), p).toBeNull()
    }
  })
})

describe('CSP', () => {
  it('production allows no inline or remote script', () => {
    expect(PROD_CSP).toContain("script-src 'self'")
    expect(PROD_CSP).not.toContain('unsafe-inline')
    expect(PROD_CSP).not.toContain('unsafe-eval')
    expect(PROD_CSP).toContain("object-src 'none'")
  })

  it('dev only adds the HMR socket for its own origin', () => {
    expect(devCsp('http://localhost:5173')).toContain("connect-src 'self' blob: ws://localhost:5173")
  })
})
