import { doBeforeEach, setup, testFileReload } from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

test('reloads alignments track (BAI 404)', async () => {
  await testFileReload({
    failingFile: 'volvox-sorted-altname.bam.bai',
    trackId: 'volvox_bam_snpcoverage',
    viewLocation: [0.5, 0],
    expectedCanvas: /^display-.*-done$/,
    timeout: 30000,
  })
}, 40000)

test('reloads alignments track (BAM 404)', async () => {
  await testFileReload({
    failingFile: 'volvox-sorted-altname.bam',
    trackId: 'volvox_bam_pileup',
    viewLocation: [0.5, 0],
    expectedCanvas: /^display-.*-done$/,
    timeout: 30000,
  })
}, 40000)
