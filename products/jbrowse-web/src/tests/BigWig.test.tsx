import { testOpenTrack } from './testOpenTrack.tsx'
import { doBeforeEach, setup } from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

test('open a bigwig track', async () => {
  await testOpenTrack({
    bpPerPx: 5,
    start: 0,
    trackId: 'volvox_microarray',
  })
}, 25000)

test('open a bigwig line track 2', async () => {
  await testOpenTrack({
    bpPerPx: 10,
    start: 0,
    trackId: 'volvox_microarray_line',
  })
}, 25000)

test('open a bigwig density track', async () => {
  await testOpenTrack({
    bpPerPx: 5,
    start: 0,
    trackId: 'volvox_microarray_density',
  })
}, 25000)
