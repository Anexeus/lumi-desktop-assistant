// Validates a .vrm (binary glTF) header and reads its embedded metadata. Pure: no Electron imports.

export const MAX_MODEL_BYTES = 256 * 1024 * 1024
const JSON_CHUNK = 0x4e4f534a // 'JSON'
const MAX_JSON_BYTES = 64 * 1024 * 1024

export interface VrmMeta {
  name: string
  authors: string[]
  licenseUrl: string | null
  specVersion: '1.0' | '0.x'
}

const text = (v: unknown, max = 200): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

export const UNNAMED = 'Unnamed model'
/** The model's title; without one (some exporters write "null"), "<author>'s model". */
function named(title: unknown, authors: string[]): string {
  const t = text(title)
  return t && t !== 'null' ? t : authors[0] ? `${authors[0]}'s model` : UNNAMED
}

/** Throws with a user-facing message when the file is not a usable VRM. */
export function readVrmMeta(buf: Uint8Array): VrmMeta {
  if (buf.byteLength > MAX_MODEL_BYTES) throw new Error('The file is larger than 256 MB.')
  if (buf.byteLength < 20) throw new Error('The file is too small to be a VRM model.')
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('Not a VRM/glTF binary file.') // 'glTF'
  if (view.getUint32(4, true) !== 2) throw new Error('Unsupported glTF version.')
  const chunkLength = view.getUint32(12, true)
  if (view.getUint32(16, true) !== JSON_CHUNK || chunkLength > MAX_JSON_BYTES || 20 + chunkLength > buf.byteLength) {
    throw new Error('The model file is damaged.')
  }

  let gltf: { extensions?: Record<string, unknown> }
  try {
    gltf = JSON.parse(new TextDecoder().decode(buf.subarray(20, 20 + chunkLength)))
  } catch {
    throw new Error('The model file is damaged.')
  }

  const ext = (gltf.extensions ?? {}) as Record<string, { meta?: Record<string, unknown> } | undefined>
  const v1 = ext['VRMC_vrm']?.meta
  if (v1) {
    const authors = Array.isArray(v1['authors']) ? v1['authors'].map((a) => text(a)).filter((a): a is string => !!a) : []
    return { name: named(v1['name'], authors), authors: authors.slice(0, 10), licenseUrl: text(v1['licenseUrl'], 500), specVersion: '1.0' }
  }
  const v0 = ext['VRM']?.meta
  if (v0) {
    const author = text(v0['author'])
    return {
      name: named(v0['title'], author ? [author] : []),
      authors: author ? [author] : [],
      licenseUrl: text(v0['otherLicenseUrl'], 500),
      specVersion: '0.x'
    }
  }
  throw new Error('This glTF file has no VRM data (it is not a VRM avatar).')
}
