import { LocalFile } from 'generic-filehandle2'

import {
  doBeforeEach,
  generateReadBuffer,
  setup,
  testFileReload,
} from './util.tsx'

const readBuffer = generateReadBuffer(
  url => new LocalFile(require.resolve(`../../test_data/volvox/${url}`)),
)

setup()

beforeEach(() => {
  doBeforeEach()
})

test('reloads vcf (VCF.GZ 404)', async () => {
  await testFileReload({
    failingFile: 'volvox.filtered.vcf.gz',
    readBuffer,
    trackId: 'volvox_filtered_vcf',
    viewLocation: [0.05, 5000],
    expectedCanvas: /prerendered_canvas/,
    timeout: 30000,
  })
}, 40000)

test('reloads vcf (VCF.GZ.TBI 404)', async () => {
  await testFileReload({
    failingFile: 'volvox.filtered.vcf.gz.tbi',
    readBuffer,
    trackId: 'volvox_filtered_vcf',
    viewLocation: [0.05, 5000],
    expectedCanvas: /prerendered_canvas/,
    timeout: 30000,
  })
}, 40000)
