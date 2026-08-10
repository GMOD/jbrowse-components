import { doBeforeEach, setup, testFileReload } from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

// `volvox_cram_pileup_ctga`, not `volvox_cram_pileup`: the latter carries
// `fetchSizeLimit: 1000`, an absurd cap that exists to trip the byte gate for
// StatsEstimation. A reload test inheriting it only ever passed because
// `AUTO_FORCE_LOAD_BP` switched the gate off at this zoom — now that alignments
// gates below the floor the cap applies at every zoom, and the track correctly
// refuses to load after a successful reload. Same file kind, same pileup
// display, no fixture cap, so this measures the reload again.
test('reloads alignments track (CRAI 404)', async () => {
  await testFileReload({
    failingFile: 'volvox-sorted.cram.crai',
    trackId: 'volvox_cram_pileup_ctga',
    viewLocation: [0.5, 0],
    displayTestId: 'pileup-display',
    timeout: 30000,
  })
}, 50000)

test('reloads alignments track (CRAM 404)', async () => {
  await testFileReload({
    failingFile: 'volvox-sorted-altname.cram',
    trackId: 'volvox_cram_snpcoverage',
    viewLocation: [0.5, 0],
    displayTestId: 'pileup-display',
    timeout: 30000,
  })
}, 50000)
