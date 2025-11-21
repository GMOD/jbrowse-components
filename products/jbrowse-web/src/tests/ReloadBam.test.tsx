import { LocalFile } from 'generic-filehandle2'

import {
  doBeforeEach,
  generateReadBuffer,
  pv,
  setup,
  testFileReload,
} from './util'

const readBuffer = generateReadBuffer(
  url => new LocalFile(require.resolve(`../../test_data/volvox/${url}`)),
)

setup()

beforeEach(() => {
  doBeforeEach()
})

test('reloads alignments track (BAI 404)', async () => {
  await testFileReload({
    failingFile: 'volvox-sorted-altname.bam.bai',
    readBuffer,
    trackId: 'volvox_bam_snpcoverage',
    viewLocation: [0.5, 0],
    expectedCanvas: pv('1..400-0'),
    timeout: 30000,
  })
}, 40000)

test('reloads alignments track (BAM 404)', async () => {
  await testFileReload({
    failingFile: 'volvox-sorted-altname.bam',
    readBuffer,
    trackId: 'volvox_bam_pileup',
    viewLocation: [0.5, 0],
    expectedCanvas: pv('1..400-0'),
    timeout: 30000,
  })
}, 40000)
