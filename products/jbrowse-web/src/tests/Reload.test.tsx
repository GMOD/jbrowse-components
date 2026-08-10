import { doBeforeEach, setup, testFileReload } from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

// One suite for the whole family. These were four files (ReloadBam,
// ReloadBigWig, ReloadCram, ReloadVcf) of two tests or fewer, each paying a
// full plugin-graph boot to call `testFileReload` with different arguments —
// and the boot, not the reload, was most of what they cost.

test('reloads alignments track (BAI 404)', async () => {
  await testFileReload({
    failingFile: 'volvox-sorted-altname.bam.bai',
    trackId: 'volvox_bam_snpcoverage',
    viewLocation: [0.5, 0],
    // any display; the reload just has to repaint something
    timeout: 30000,
  })
}, 40000)

test('reloads alignments track (BAM 404)', async () => {
  await testFileReload({
    failingFile: 'volvox-sorted-altname.bam',
    trackId: 'volvox_bam_pileup',
    viewLocation: [0.5, 0],
    // any display; the reload just has to repaint something
    timeout: 30000,
  })
}, 40000)

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

test('reloads bigwig (BW 404)', async () => {
  await testFileReload({
    failingFile: 'volvox_microarray.bw',
    trackId: 'volvox_microarray',
    viewLocation: [10, 0],
    // any display; the reload just has to repaint something
    timeout: 50000,
  })
}, 50000)

test('reloads vcf (VCF.GZ 404)', async () => {
  await testFileReload({
    failingFile: 'volvox.filtered.vcf.gz',
    trackId: 'volvox_filtered_vcf',
    viewLocation: [0.05, 5000],
    // any display; the reload just has to repaint something
    timeout: 30000,
  })
}, 40000)

test('reloads vcf (VCF.GZ.TBI 404)', async () => {
  await testFileReload({
    failingFile: 'volvox.filtered.vcf.gz.tbi',
    trackId: 'volvox_filtered_vcf',
    viewLocation: [0.05, 5000],
    // any display; the reload just has to repaint something
    timeout: 30000,
  })
}, 40000)
