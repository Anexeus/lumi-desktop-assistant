// Models for Lumi's built-in engines. Downloaded on first use (not bundled: 2.5 GB would make a fragile installer),
// resumed after interruptions, and verified against the publisher's SHA-256 before use.

export interface LocalModel {
  id: string
  kind: 'llm' | 'stt'
  name: string
  file: string
  /** Tried in order; the checksum, not the host, is what makes a file trusted. */
  urls: string[]
  size: number
  sha256: string
  license: string
  /** Plain-language hardware note. */
  needs: string
  /** Vision adapter (a second file) for models that can see images, e.g. screenshots. */
  mmproj?: { file: string; urls: string[]; size: number; sha256: string }
}

const hf = (repo: string, file: string): string[] => [
  `https://huggingface.co/${repo}/resolve/main/${file}`,
  `https://hf-mirror.com/${repo}/resolve/main/${file}` // community mirror, used only if Hugging Face fails
]

export const LOCAL_MODELS: readonly LocalModel[] = [
  {
    id: 'qwen3-vl-4b',
    kind: 'llm',
    name: 'Qwen3-VL 4B Instruct (recommended: faster answers, follows instructions better, can see the screen)',
    file: 'Qwen3VL-4B-Instruct-Q4_K_M.gguf',
    urls: hf('Qwen/Qwen3-VL-4B-Instruct-GGUF', 'Qwen3VL-4B-Instruct-Q4_K_M.gguf'),
    size: 2_497_281_664,
    sha256: '66358cb18bb6b3b1b6675aa412c7a88ef01d228f481184d13668e5201c730a0a',
    license: 'Apache-2.0',
    needs: 'About 4.5 GB of GPU memory with its vision part (or 6 GB of RAM on CPU, slower).',
    mmproj: {
      file: 'mmproj-Qwen3VL-4B-Instruct-Q8_0.gguf',
      urls: hf('Qwen/Qwen3-VL-4B-Instruct-GGUF', 'mmproj-Qwen3VL-4B-Instruct-Q8_0.gguf'),
      size: 453_974_304,
      sha256: '30ba2c7dd3127a4561b6cba9d13d0f711c91bdb38742e2f56d73c8cb596bd06d'
    }
  },
  {
    id: 'qwen3-4b',
    kind: 'llm',
    name: 'Qwen3 4B (older; text only)',
    file: 'Qwen3-4B-Q4_K_M.gguf',
    urls: hf('Qwen/Qwen3-4B-GGUF', 'Qwen3-4B-Q4_K_M.gguf'),
    size: 2_497_280_256,
    sha256: '7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5',
    license: 'Apache-2.0',
    needs: 'About 3.5 GB of GPU memory (or 5 GB of RAM on CPU, slower).'
  },
  {
    id: 'qwen3-1.7b',
    kind: 'llm',
    name: 'Qwen3 1.7B (lighter, for older PCs)',
    file: 'Qwen3-1.7B-Q8_0.gguf',
    urls: hf('Qwen/Qwen3-1.7B-GGUF', 'Qwen3-1.7B-Q8_0.gguf'),
    size: 1_834_426_016,
    sha256: '061b54daade076b5d3362dac252678d17da8c68f07560be70818cace6590cb1a',
    license: 'Apache-2.0',
    needs: 'About 2.5 GB of memory. Less capable with tools.'
  },
  {
    id: 'whisper-small-en',
    kind: 'stt',
    name: 'Whisper small (English, accurate)',
    file: 'ggml-small.en-q5_1.bin',
    urls: hf('ggerganov/whisper.cpp', 'ggml-small.en-q5_1.bin'),
    size: 190_098_681,
    sha256: 'bfdff4894dcb76bbf647d56263ea2a96645423f1669176f4844a1bf8e478ad30',
    license: 'MIT',
    needs: 'About 400 MB of RAM. Runs on the CPU.'
  },
  {
    id: 'whisper-base-en',
    kind: 'stt',
    name: 'Whisper base (English, fastest)',
    file: 'ggml-base.en-q5_1.bin',
    urls: hf('ggerganov/whisper.cpp', 'ggml-base.en-q5_1.bin'),
    size: 59_721_011,
    sha256: '4baf70dd0d7c4247ba2b81fafd9c01005ac77c2f9ef064e00dcf195d0e2fdd2f',
    license: 'MIT',
    needs: 'About 200 MB of RAM. Less accurate with accents.'
  }
]

export const findLocalModel = (id: string): LocalModel | undefined => LOCAL_MODELS.find((m) => m.id === id)
export const LOCAL_MODEL_IDS = LOCAL_MODELS.map((m) => m.id) as [string, ...string[]]
