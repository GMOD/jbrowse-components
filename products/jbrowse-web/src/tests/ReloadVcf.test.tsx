import { doBeforeEach, setup, testFileReload } from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

test('reloads vcf (VCF.GZ 404)', async () => {
  await testFileReload({
    failingFile: 'volvox.filtered.vcf.gz',
    trackId: 'volvox_filtered_vcf',
    viewLocation: [0.05, 5000],
    expectedCanvas: /^display-.*-done$/,
    timeout: 30000,
  })
}, 40000)

test('reloads vcf (VCF.GZ.TBI 404)', async () => {
  await testFileReload({
    failingFile: 'volvox.filtered.vcf.gz.tbi',
    trackId: 'volvox_filtered_vcf',
    viewLocation: [0.05, 5000],
    expectedCanvas: /^display-.*-done$/,
    timeout: 30000,
  })
}, 40000)
