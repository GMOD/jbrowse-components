import { testLinkedReadsDisplay } from './renderingUtils'
import { doBeforeEach, setup } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const timeout = 100000

const testCloud = (loc: string, track: string) =>
  testLinkedReadsDisplay({
    loc,
    track,
    displayMode: 'cloud',
    canvasId: 'cloud-canvas',
    timeout,
  })

test(
  'short-read cloud display',
  async () => {
    await testCloud('ctgA:1-50000', 'volvox_sv_cram')
  },
  timeout,
)

test(
  'long-read cloud display',
  async () => {
    await testCloud('ctgA:19,101..32,027', 'volvox-simple-inv.bam')
  },
  timeout,
)

test(
  'long-read cloud display, out of view pairing',
  async () => {
    await testCloud('ctgA:478..6,191', 'volvox-long-reads-sv-cram')
  },
  timeout,
)

test(
  'short-read cloud display, out of view pairing',
  async () => {
    await testCloud('ctgA:478..6,191', 'volvox_sv_cram')
  },
  timeout,
)
