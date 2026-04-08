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

test('reloads bigwig (BW 404)', async () => {
  await testFileReload({
    failingFile: 'volvox_microarray.bw',
    readBuffer,
    trackId: 'volvox_microarray',
    viewLocation: [10, 0],
    expectedCanvas: /^display-.*-done$/,
    timeout: 50000,
  })
}, 50000)
