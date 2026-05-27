import { testLinkedReadsDisplay } from './testLinkedReadsDisplay.tsx'
import { doBeforeEach, setup } from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

const timeout = 100000

const testLinked = (loc: string, track: string) =>
  testLinkedReadsDisplay({ loc, track, displayMode: 'cloud', timeout })

const testBezier = (loc: string, track: string) =>
  testLinkedReadsDisplay({ loc, track, displayMode: 'bezier', timeout })

test(
  'short-read linked reads display',
  async () => {
    await testLinked('ctgA:1..46,392', 'volvox_sv_cram')
  },
  timeout,
)

test(
  'long-read linked reads display',
  async () => {
    await testLinked('ctgA:1..46,392', 'volvox-simple-inv.bam')
  },
  timeout,
)

test(
  'long-read linked reads display, out of view pairing',
  async () => {
    await testLinked('ctgA:478..6,191', 'volvox-long-reads-sv-cram')
  },
  timeout,
)

test(
  'short-read linked reads display, bezier connections',
  async () => {
    await testBezier('ctgA:1..46,392', 'volvox_sv_cram')
  },
  timeout,
)

test(
  'short-read linked reads display, out of view pairing',
  async () => {
    await testLinked('ctgA:478..6,191', 'volvox_sv_cram')
  },
  timeout,
)
