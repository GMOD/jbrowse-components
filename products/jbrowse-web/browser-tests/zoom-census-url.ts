/* eslint-disable no-console */
// Prints the URL the browser-side counterpart of `ZoomRenderCensus` profiles,
// and serves `build/` until killed, so `profile-zoom.ts` has something to open.
//
//   node browser-tests/zoom-census-url.ts &
//   URL="$(...)" node browser-tests/profile-zoom.ts
//
// Mid-contig on purpose (`ctgA:20000-24000`, not the `1-` every other probe
// uses): a view sitting at the genome start keeps a boundary PaddingBlock on
// screen for the whole gesture, which is the one regime where the per-track
// padding overlay has something to draw and so the one regime that cannot see
// whether it stopped drawing it.
import { encodeSessionSpec } from '@jbrowse/browser-test-utils'

import { startServerOnFreePort } from './server.ts'

const TRACKS = [
  'volvox_microarray',
  'volvox_microarray_multi',
  'volvox_filtered_vcf',
  'volvox_gc',
  'volvox_microarray_line',
  'volvox_microarray_density',
  'volvox_test_vcf',
  'volvox_microarray_color',
]

const { port } = await startServerOnFreePort(3000)
const spec = encodeSessionSpec({
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: 'ctgA:20000-24000',
      tracks: TRACKS,
    },
  ],
})
console.log(
  `http://localhost:${port}/?config=test_data/volvox/config.json&sessionName=Census&session=${spec}`,
)
