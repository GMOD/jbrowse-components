import { act, waitFor } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  findDisplayPainted,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

setup()

const TRACK_IDS = [
  'volvox_microarray',
  'volvox_microarray_multi',
  'volvox_filtered_vcf',
  'volvox_gc',
]

const FRAMES = 20
const STEP = 1.15

beforeEach(() => {
  doBeforeEach()
})

// `zoom-perf-followups.md` prescribes counting the mints before touching the
// blob-URL path: ~100ms over "a few dozen tokens a gesture" is ~2.5ms a call,
// implausible for a registry insert, and a strong hint the sampler folds the
// revoke or GC into that frame. This is that count. It does not need a browser
// — the rotation that mints is model-side, and jsdom drives it identically.
test('how many stop tokens a zoom gesture mints', async () => {
  const { view } = await createView(volvoxConfigWithTracks(TRACK_IDS))
  view.setNewView(5, 0)
  for (const trackId of TRACK_IDS) {
    view.showTrack(trackId)
  }
  await waitFor(
    () => {
      expect(view.tracks.length).toBe(TRACK_IDS.length)
    },
    { timeout: 30000 },
  )
  await findDisplayPainted('wiggle-display', { timeout: 30000 })

  // Count the primitive, not the module export: a spy on the ESM namespace only
  // sees callers that go through it, and undercounting here would be the whole
  // answer. jsdom has no `createObjectURL` at all — which is why every token
  // under jest is normally a `nanoid` — so this installs one, putting
  // `createStringToken` on the branch a browser takes and making the count
  // exact. Ids must be distinct or the stopped-id map collides across tokens.
  let mints = 0
  let revokes = 0
  const U = URL as unknown as {
    createObjectURL?: (b: Blob) => string
    revokeObjectURL?: (u: string) => void
  }
  U.createObjectURL = () => `blob:jest/${++mints}`
  U.revokeObjectURL = () => {
    revokes++
  }

  for (let i = 0; i < FRAMES; i++) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      view.zoomTo(view.bpPerPx * STEP)
    })
  }

  delete U.createObjectURL
  delete U.revokeObjectURL

  // eslint-disable-next-line no-console
  console.log(
    `\n=== ${FRAMES} zoom frames, ${view.tracks.length} tracks ===\n` +
      `URL.createObjectURL: ${mints} (${(mints / FRAMES).toFixed(2)}/frame)\n` +
      `URL.revokeObjectURL: ${revokes}\n`,
  )
}, 90000)
