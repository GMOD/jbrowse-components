import { LocalFile } from 'generic-filehandle2'

import { doBeforeEach, generateReadBuffer, setup, testFileReload } from './util'

const readBuffer = generateReadBuffer(
  url => new LocalFile(require.resolve(`../../test_data/volvox/${url}`)),
)

setup()

beforeEach(() => {
  doBeforeEach()
})

test('reloads alignments track (CRAI 404)', async () => {
  await testFileReload({
    failingFile: 'volvox-sorted-altname.cram.crai',
    readBuffer,
    trackId: 'volvox_cram_pileup',
    viewLocation: [0.5, 0],
    expectedCanvas: /prerendered_canvas/,
    timeout: 5000,
  })
}, 10000)

test('reloads alignments track (CRAM 404)', async () => {
  await testFileReload({
    failingFile: 'volvox-sorted-altname.cram',
    readBuffer,
    trackId: 'volvox_cram_snpcoverage',
    viewLocation: [0.5, 0],
    expectedCanvas: /prerendered_canvas/,
    timeout: 5000,
  })
}, 10000)
