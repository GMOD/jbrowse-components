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

test('reloads alignments track (BAI 404)', async () => {
  await testFileReload({
    failingFile: 'volvox-sorted-altname.bam.bai',
    readBuffer,
    trackId: 'volvox_bam_snpcoverage',
    viewLocation: [0.5, 0],
    expectedCanvas: /^display-.*-done$/,
    timeout: 30000,
  })
}, 40000)

test('reloads alignments track (BAM 404)', async () => {
  await testFileReload({
    failingFile: 'volvox-sorted-altname.bam',
    readBuffer,
    trackId: 'volvox_bam_pileup',
    viewLocation: [0.5, 0],
    expectedCanvas: /^display-.*-done$/,
    timeout: 30000,
  })
}, 40000)
