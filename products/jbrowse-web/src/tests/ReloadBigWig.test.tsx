import { doBeforeEach, setup, testFileReload } from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

test('reloads bigwig (BW 404)', async () => {
  await testFileReload({
    failingFile: 'volvox_microarray.bw',
    trackId: 'volvox_microarray',
    viewLocation: [10, 0],
    // any display; the reload just has to repaint something
    timeout: 50000,
  })
}, 50000)
