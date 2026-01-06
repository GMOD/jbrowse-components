import { testLinkedReadsDisplay } from './testLinkedReadsDisplay.tsx'
import { doBeforeEach, setup } from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

const timeout = 90000
const testArc = (loc: string, track: string) =>
  testLinkedReadsDisplay({
    loc,
    track,
    displayMode: 'arc',
    canvasId: 'arc-canvas',
    timeout: timeout - 5000,
  })

test(
  'short-read arc display',
  async () => {
    await testArc('ctgA:1-50000', 'volvox_sv_cram')
  },
  timeout,
)

test(
  'long-read arc display',
  async () => {
    await testArc('ctgA:19,101..32,027', 'volvox-simple-inv.bam')
  },
  timeout,
)

test(
  'long-read arc display, out of view pairing',
  async () => {
    await testArc('ctgA:478..6,191', 'volvox-long-reads-sv-cram')
  },
  timeout,
)

test(
  'short-read arc display, out of view pairing',
  async () => {
    await testArc('ctgA:478..6,191', 'volvox_sv_cram')
  },
  timeout,
)
