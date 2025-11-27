import { doBeforeEach, setup, testLinkedReadsDisplay } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const testArc = (loc: string, track: string) =>
  testLinkedReadsDisplay({ loc, track, displayMode: 'arc', canvasId: 'arc-canvas' })

test('short-read arc display', async () => {
  await testArc('ctgA:1-50000', 'volvox_sv_cram')
}, 60000)

test('long-read arc display', async () => {
  await testArc('ctgA:19,101..32,027', 'volvox-simple-inv.bam')
}, 60000)

test('long-read arc display, out of view pairing', async () => {
  await testArc('ctgA:478..6,191', 'volvox-long-reads-sv-cram')
}, 60000)

test('short-read arc display, out of view pairing', async () => {
  await testArc('ctgA:478..6,191', 'volvox_sv_cram')
}, 60000)
