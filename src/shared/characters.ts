// Characters bundled in src/renderer/public/models. Every license here allows redistribution (see DECISIONS.md).

export const CHARACTERS = [
  {
    id: 'miku',
    name: 'Hatsune Miku',
    file: 'Hatsune-Miku-RemiX3.vrm',
    authors: ['RemiX3'],
    license: 'VRoid Hub licence: redistribution allowed with credit, non-commercial, unmodified. Hatsune Miku © Crypton Future Media, INC. www.piapro.net',
    licenseUrl:
      'https://hub.vroid.com/license?allowed_to_use_user=everyone&characterization_allowed_user=everyone&corporate_commercial_use=disallow&credit=necessary&modification=disallow&personal_commercial_use=disallow&redistribution=allow&sexual_expression=disallow&version=1&violent_expression=allow',
    voice: 'female'
  },
  {
    id: 'seed-san',
    name: 'Seed-san',
    file: 'Seed-san.vrm',
    authors: ['VirtualCast, Inc.'],
    license: 'VRM Public License 1.0',
    licenseUrl: 'https://vrm.dev/licenses/1.0/',
    voice: 'male'
  },
  {
    id: 'shino',
    name: 'Sendagaya Shino',
    file: 'Sendagaya-Shino.vrm',
    authors: ['VRoid Project'],
    license: 'CC0 (VRoid Studio sample model)',
    licenseUrl: 'https://opengameart.org/content/vroid-studio-cc0-models',
    voice: 'female'
  },
  {
    id: 'shibu',
    name: 'Sendagaya Shibu',
    file: 'Sendagaya-Shibu.vrm',
    authors: ['VRoid Project'],
    license: 'CC0 (VRoid Studio sample model)',
    licenseUrl: 'https://opengameart.org/content/vroid-studio-cc0-models',
    voice: 'female'
  },
  {
    id: 'fumiriya',
    name: 'Sakurada Fumiriya',
    file: 'Sakurada-Fumiriya.vrm',
    authors: ['VRoid Project'],
    license: 'CC0 (VRoid Studio sample model)',
    licenseUrl: 'https://opengameart.org/content/vroid-studio-cc0-models',
    voice: 'male'
  },
  {
    id: 'hoodie',
    name: 'Hoodie boy',
    file: 'VRoid-Hoodie-Boy.vrm',
    authors: ['VRoid Project'],
    license: 'CC0 (VRoid Studio sample model)',
    licenseUrl: 'https://opengameart.org/content/vroid-studio-cc0-models',
    voice: 'male'
  },
  {
    id: 'vita',
    name: 'Vita',
    file: 'VRoid-Vita.vrm',
    authors: ['VRoid Project'],
    license: 'CC0 (VRoid Studio sample model)',
    licenseUrl: 'https://opengameart.org/content/vroid-studio-cc0-models',
    voice: 'female'
  },
  {
    id: 'bibi',
    name: 'Bibi',
    file: 'VRoid-Bibi.vrm',
    authors: ['VRoid Project'],
    license: 'CC0 (VRoid Studio sample model)',
    licenseUrl: 'https://opengameart.org/content/vroid-studio-cc0-models',
    voice: 'female'
  },
  {
    id: 'victoria',
    name: 'Victoria Rubin',
    file: 'VRoid-Victoria.vrm',
    authors: ['VRoid Project'],
    license: 'CC0 (VRoid Studio sample model)',
    licenseUrl: 'https://opengameart.org/content/vroid-studio-cc0-models',
    voice: 'female'
  },
  {
    id: 'darkness',
    name: 'Darkness Shibu',
    file: 'VRoid-Darkness.vrm',
    authors: ['VRoid Project'],
    license: 'CC0 (VRoid Studio sample model)',
    licenseUrl: 'https://opengameart.org/content/vroid-studio-cc0-models',
    voice: 'female'
  }
] as const

export type CharacterId = (typeof CHARACTERS)[number]['id']
export const CHARACTER_IDS = CHARACTERS.map((c) => c.id) as [CharacterId, ...CharacterId[]]
export const findCharacter = (id: string): (typeof CHARACTERS)[number] => CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0]

/** One of the user's own models: 'mine:' and the first 12 hex digits of the file's SHA-256 (see main/model.ts). */
export const MY_MODEL_ID = /^mine:[0-9a-f]{12}$/
/** What the character setting holds: a bundled character or one of the user's own models. */
export type CharacterChoice = CharacterId | `mine:${string}`
