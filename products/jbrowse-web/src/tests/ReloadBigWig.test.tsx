import { LocalFile } from 'generic-filehandle2'
import { beforeEach, test } from 'vitest'

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

test('reloads bigwig (BW 404)', async () => {
  await testFileReload({
    failingFile: 'volvox_microarray.bw',
    readBuffer,
    trackId: 'volvox_microarray',
    viewLocation: [10, 0],
    expectedCanvas: pv('1..8000-0'),
    timeout: 50000,
  })
}, 50000)
