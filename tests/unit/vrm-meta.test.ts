import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { readVrmMeta } from '../../src/main/vrm-meta'

function glb(json: unknown, opts: { magic?: number; version?: number; chunkType?: number } = {}): Uint8Array {
  const body = new TextEncoder().encode(JSON.stringify(json))
  const buf = new Uint8Array(20 + body.byteLength)
  const view = new DataView(buf.buffer)
  view.setUint32(0, opts.magic ?? 0x46546c67, true)
  view.setUint32(4, opts.version ?? 2, true)
  view.setUint32(8, buf.byteLength, true)
  view.setUint32(12, body.byteLength, true)
  view.setUint32(16, opts.chunkType ?? 0x4e4f534a, true)
  buf.set(body, 20)
  return buf
}

describe('readVrmMeta', () => {
  it('reads the bundled Seed-san model', () => {
    const meta = readVrmMeta(readFileSync('src/renderer/public/models/Seed-san.vrm'))
    expect(meta).toEqual({
      name: 'Seed-san',
      authors: ['VirtualCast, Inc.'],
      licenseUrl: 'https://vrm.dev/licenses/1.0/',
      specVersion: '1.0'
    })
  })

  it('reads VRM 0.x metadata', () => {
    const meta = readVrmMeta(glb({ extensions: { VRM: { meta: { title: 'Old', author: 'Someone', otherLicenseUrl: 'https://x' } } } }))
    expect(meta).toEqual({ name: 'Old', authors: ['Someone'], licenseUrl: 'https://x', specVersion: '0.x' })
  })

  it('trims and caps untrusted strings', () => {
    const meta = readVrmMeta(glb({ extensions: { VRMC_vrm: { meta: { name: '  ' + 'x'.repeat(500), authors: [1, '', 'A'] } } } }))
    expect(meta.name).toHaveLength(200)
    expect(meta.authors).toEqual(['A'])
  })

  it('rejects files that are not VRM', () => {
    expect(() => readVrmMeta(new Uint8Array(10))).toThrow(/too small/)
    expect(() => readVrmMeta(glb({}, { magic: 0x12345678 }))).toThrow(/Not a VRM/)
    expect(() => readVrmMeta(glb({}, { version: 1 }))).toThrow(/version/)
    expect(() => readVrmMeta(glb({}, { chunkType: 0 }))).toThrow(/damaged/)
    expect(() => readVrmMeta(glb({ asset: { version: '2.0' } }))).toThrow(/no VRM data/)
  })

  it('rejects a chunk length that points past the end of the file', () => {
    const buf = glb({ extensions: {} })
    new DataView(buf.buffer).setUint32(12, 10_000, true)
    expect(() => readVrmMeta(buf)).toThrow(/damaged/)
  })

  it('rejects broken JSON', () => {
    const buf = glb({ a: 1 })
    buf[21] = 0x7b // '{{' after the opening brace
    expect(() => readVrmMeta(buf)).toThrow(/damaged/)
  })
})
