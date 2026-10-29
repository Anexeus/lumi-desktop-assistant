import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { LocalModel } from '../../src/shared/localModels'
import { downloadModel, pickDevice } from '../../src/main/ai/local'

const data = Buffer.from('pretend these are model weights '.repeat(1000))
const model = (urls: string[], sha256 = createHash('sha256').update(data).digest('hex')): LocalModel => ({
  id: 'm',
  kind: 'llm',
  name: 'Test model',
  file: 'model.gguf',
  urls,
  size: data.length,
  sha256,
  license: 'MIT',
  needs: ''
})

/** A fake host that serves `data` (honouring Range) and can be told to fail or cut the connection. */
function host(opts: { failFirst?: number; cutAt?: number } = {}) {
  const ranges: (string | null)[] = []
  let calls = 0
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    calls++
    const range = (init?.headers as Record<string, string> | undefined)?.['Range'] ?? null
    ranges.push(range)
    if (calls <= (opts.failFirst ?? 0)) throw new Error('connection reset')
    const start = range ? Number(/bytes=(\d+)-/.exec(range)![1]) : 0
    const end = calls === 1 && opts.cutAt ? opts.cutAt : data.length
    return new Response(data.subarray(start, end), { status: range ? 206 : 200 })
  }) as unknown as typeof fetch
  return { fetchImpl, ranges }
}

describe('downloadModel', () => {
  it('resumes after the connection drops and verifies the checksum', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'models-'))
    const { fetchImpl, ranges } = host({ cutAt: 5000 })
    const file = await downloadModel(model(['https://a/model']), dir, () => {}, new AbortController().signal, fetchImpl)
    expect(readFileSync(file).equals(data)).toBe(true)
    expect(ranges).toEqual([null, 'bytes=5000-'])
  }, 20_000)

  it('falls back to the next mirror when the first keeps failing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'models-'))
    const { fetchImpl } = host({ failFirst: 4 })
    const file = await downloadModel(model(['https://a/model', 'https://b/model']), dir, () => {}, new AbortController().signal, fetchImpl)
    expect(readFileSync(file).equals(data)).toBe(true)
  }, 30_000)

  it('rejects a file whose checksum does not match, and does not keep it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'models-'))
    const { fetchImpl } = host()
    await expect(downloadModel(model(['https://a/model'], 'f'.repeat(64)), dir, () => {}, new AbortController().signal, fetchImpl)).rejects.toThrow(/checksum/)
    expect(existsSync(join(dir, 'model.gguf'))).toBe(false)
    expect(existsSync(join(dir, 'model.gguf.part'))).toBe(false)
  })

  it('reuses a finished file without downloading again', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'models-'))
    writeFileSync(join(dir, 'model.gguf'), data)
    const { fetchImpl, ranges } = host()
    await downloadModel(model(['https://a/model']), dir, () => {}, new AbortController().signal, fetchImpl)
    expect(ranges).toEqual([])
  })
})

describe('pickDevice', () => {
  it('picks the GPU with the most memory, not the first (often integrated) one', () => {
    const listing = `Available devices:
  Vulkan0: Intel(R) UHD Graphics 770 (8051 MiB, 7393 MiB free)
  Vulkan1: NVIDIA GeForce RTX 4050 Laptop GPU (5920 MiB, 5152 MiB free)`
    // The iGPU reports shared system memory as its size, so the dedicated GPU must win on name too.
    expect(pickDevice(listing)?.name).toBe('NVIDIA GeForce RTX 4050 Laptop GPU')
    expect(pickDevice('Available devices:\n')).toBeNull()
  })
})
