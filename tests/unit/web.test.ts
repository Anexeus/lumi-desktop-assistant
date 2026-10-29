import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { on: () => {} }, BrowserWindow: class {}, session: {}, shell: {} }))
const { downloadName, isPublicWebUrl, lenientItem, lenientOpen, openTarget, unwrapResultUrl } = await import('../../src/main/tools/web')

describe('isPublicWebUrl', () => {
  it('allows public http(s) pages', () => {
    for (const u of ['https://example.com', 'http://docs.python.org/3/', 'https://8.8.8.8/x', 'https://[2606:4700::1111]/']) expect(isPublicWebUrl(u), u).toBe(true)
  })

  it('blocks local, private and non-web addresses', () => {
    for (const u of [
      'http://localhost:11434/api',
      'http://127.0.0.1:3000',
      'http://10.0.0.1',
      'http://192.168.1.1/admin',
      'http://172.20.0.5',
      'http://169.254.169.254/latest/meta-data',
      'http://100.64.1.1',
      'http://[::1]/',
      'http://[fe80::1]/',
      'http://router/',
      'http://printer.local/',
      'file:///C:/Windows/win.ini',
      'app://bundle/chat.html',
      'javascript:alert(1)',
      'https://user:pass@example.com',
      'not a url'
    ]) {
      expect(isPublicWebUrl(u), u).toBe(false)
    }
  })
})

describe('unwrapResultUrl', () => {
  it('extracts the real link from a search redirect', () => {
    expect(unwrapResultUrl('//duckduckgo.com/l/?uddg=https%3A%2F%2Fnodejs.org%2Fdocs&rut=x')).toBe('https://nodejs.org/docs')
    expect(unwrapResultUrl('https://example.com/a')).toBe('https://example.com/a')
  })
})

describe('openTarget', () => {
  it('builds a site search, a site home page, or passes a url through', () => {
    expect(openTarget({ site: 'youtube', query: 'lofi hip hop & chill' })).toBe('https://www.youtube.com/results?search_query=lofi%20hip%20hop%20%26%20chill')
    expect(openTarget({ site: 'youtube' })).toBe('https://www.youtube.com')
    expect(openTarget({ url: 'https://example.com/a' })).toBe('https://example.com/a')
  })
})

describe('downloadName', () => {
  it('takes the name from the header or the URL and makes it safe', () => {
    expect(downloadName('https://x.com/files/report%20v2.pdf', null)).toBe('report v2.pdf')
    expect(downloadName('https://x.com/get?id=1', 'attachment; filename="setup.exe"')).toBe('setup.exe')
    expect(downloadName('https://x.com/a/..%5C..%5Cevil.txt', null)).toBe('_.._evil.txt')
    expect(downloadName('https://x.com/', null)).toBe('download')
  })
})

describe('lenient browser arguments', () => {
  it('fixes the usual small-model slips instead of rejecting them', () => {
    expect(lenientOpen({ site: 'YouTube', query: 'lofi' })).toEqual({ site: 'youtube', query: 'lofi' })
    expect(lenientOpen({ site: 'youtube.com' })).toEqual({ site: 'youtube' })
    expect(lenientOpen({ site: 'example.net' })).toEqual({ url: 'https://example.net' })
    expect(lenientOpen({ url: 'www.wikipedia.org' })).toEqual({ url: 'https://www.wikipedia.org' })
    expect(lenientOpen({ query: 'weather delhi' })).toEqual({ query: 'weather delhi', site: 'google' })
    expect(lenientItem({ index: '3' })).toEqual({ index: '3', item: '3' })
    expect(lenientItem({ item: 2 })).toEqual({ item: 2 })
  })
})
