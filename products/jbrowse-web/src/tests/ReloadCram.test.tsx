import { doBeforeEach, setup, testFileReload } from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

test('reloads alignments track (CRAI 404)', async () => {
  await testFileReload({
    failingFile: 'volvox-sorted-altname.cram.crai',
    trackId: 'volvox_cram_pileup',
    viewLocation: [0.5, 0],
    expectedCanvas: 'pileup-display-done',
    timeout: 30000,
  })
}, 50000)

test('reloads alignments track (CRAM 404)', async () => {
  await testFileReload({
    failingFile: 'volvox-sorted-altname.cram',
    trackId: 'volvox_cram_snpcoverage',
    viewLocation: [0.5, 0],
    expectedCanvas: 'pileup-display-done',
    timeout: 30000,
  })
}, 50000)
