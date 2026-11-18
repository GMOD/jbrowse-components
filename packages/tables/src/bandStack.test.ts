import { createTablesEngine } from './index.ts'
import { PAIRED_INVERSION, SPLICED } from './volvox.fixture.ts'

const engine = createTablesEngine()

const spliced = (display: Record<string, unknown>) =>
  engine.alignments({ ...SPLICED, display })

const paired = (display: Record<string, unknown>) =>
  engine.alignments({ ...PAIRED_INVERSION, display })

test('by default the junctions draw over coverage and the read connections below it', async () => {
  const t = await paired({ readConnections: { show: true, height: 30 } })
  expect(t.bandStack).toEqual({
    key: ['coverage', 'readConnections', 'sashimi'],
    heightPx: [t.coverageScale.heightPx, 30, 0],
  })
  const { junctions, bandStack } = await spliced({})
  expect(junctions.band.length).toBeGreaterThan(0)
  expect(new Set(junctions.band)).toEqual(new Set(['coverage']))
  expect(bandStack.heightPx[bandStack.key.indexOf('sashimi')]).toBe(0)
})

test('a read connections strip above coverage is listed before it, at its height', async () => {
  const t = await paired({
    readConnections: { show: true, placement: 'above', height: 30 },
  })
  expect(t.bandStack).toEqual({
    key: ['readConnections', 'coverage', 'sashimi'],
    heightPx: [30, t.coverageScale.heightPx, 0],
  })
  expect(t.arcScale).toMatchObject({ band: 'arcs', reverse: false })
})

test('read connections over coverage reserve no px of their own', async () => {
  const t = await paired({
    readConnections: { show: true, placement: 'overlay', height: 30 },
  })
  expect(t.bandStack).toEqual({
    key: ['coverage', 'readConnections', 'sashimi'],
    heightPx: [t.coverageScale.heightPx, 0, 0],
  })
  expect(t.arcScale).toMatchObject({ band: 'coverage' })
})

test.each([
  ['above', ['sashimi', 'coverage', 'readConnections']],
  ['below', ['coverage', 'readConnections', 'sashimi']],
] as const)(
  'under sashimi placement %s every junction draws in the strip, at its height',
  async (placement, key) => {
    const { junctions, bandStack, coverageScale } = await spliced({
      sashimi: { placement, height: 50 },
    })
    expect(junctions.band.length).toBeGreaterThan(0)
    expect(new Set(junctions.band)).toEqual(new Set(['sashimi']))
    expect(bandStack.key).toEqual(key)
    expect(
      key.map(k =>
        k === 'sashimi' ? 50 : k === 'coverage' ? coverageScale.heightPx : 0,
      ),
    ).toEqual(bandStack.heightPx)
  },
)

test('with both strips above coverage the read connections lead', async () => {
  const { bandStack } = await spliced({
    sashimi: { placement: 'above' },
    readConnections: { show: true, placement: 'above' },
  })
  expect(bandStack.key).toEqual(['readConnections', 'sashimi', 'coverage'])
})

test('with coverage hidden an overlaid junction draws in the strip', async () => {
  const { junctions, bandStack } = await spliced({
    coverage: { show: false },
    sashimi: { height: 50 },
  })
  expect(new Set(junctions.band)).toEqual(new Set(['sashimi']))
  expect(bandStack).toEqual({
    key: ['coverage', 'readConnections', 'sashimi'],
    heightPx: [0, 0, 50],
  })
})

// A junction the filter hides is in no lane's strip set, and still names the
// band its placement gives every junction.
test('a hidden junction names the band its placement puts it in', async () => {
  const { junctions } = await spliced({
    sashimi: { placement: 'below' },
    filter: [{ field: 'junction.reads', gte: 1_000_000 }],
  })
  expect(junctions.shown.some(Boolean)).toBe(false)
  expect(new Set(junctions.band)).toEqual(new Set(['sashimi']))
})
