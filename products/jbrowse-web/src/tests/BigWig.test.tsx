import { testOpenTrack } from './testOpenTrack'
import { doBeforeEach, setup } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

test('open a bigwig track', async () => {
  await testOpenTrack({
    bpPerPx: 5,
    start: 0,
    trackId: 'volvox_microarray',
    canvasLoc: '1..4000-0',
  })
}, 25000)

test('open a bigwig line track 2', async () => {
  await testOpenTrack({
    bpPerPx: 10,
    start: 0,
    trackId: 'volvox_microarray_line',
    canvasLoc: '1..8000-0',
  })
}, 25000)

test('open a bigwig density track', async () => {
  await testOpenTrack({
    bpPerPx: 5,
    start: 0,
    trackId: 'volvox_microarray_density',
    canvasLoc: '1..4000-0',
  })
}, 25000)
