import { createTablesEngine } from './index.ts'
import { PAIRED_INVERSION } from './volvox.fixture.ts'

const engine = createTablesEngine()

const scaleUnder = async (readConnections: Record<string, unknown>) =>
  engine.alignments({
    ...PAIRED_INVERSION,
    display: { readConnections: { show: true, ...readConnections } },
  })

test('arcs hang from their own band under placement down, short of half the widest stroke', async () => {
  const { arcScale } = await scaleUnder({
    height: 40,
    encoding: { strokeWidth: { field: 'reads', scale: { range: [2, 8] } } },
  })
  expect(arcScale).toEqual({
    band: 'arcs',
    heightPx: 40,
    type: 'linear',
    reverse: true,
    marginPx: 4,
    reachPx: 36,
    insetPx: 0,
    domain: null,
  })
})

test('arcs rise inside the coverage band under placement up, above its baseline', async () => {
  const t = await engine.alignments({
    ...PAIRED_INVERSION,
    display: {
      coverage: { height: 60 },
      readConnections: { show: true, placement: 'up' },
    },
  })
  expect(t.arcScale).toMatchObject({
    band: 'coverage',
    heightPx: 60 - t.glyph.coverageInset,
    reverse: false,
    type: 'linear',
  })
  const bare = await engine.alignments({
    ...PAIRED_INVERSION,
    display: {
      coverage: { show: false },
      readConnections: { show: true, placement: 'up', height: 30 },
    },
  })
  expect(bare.arcScale).toMatchObject({
    band: 'arcs',
    heightPx: 30,
    reverse: false,
  })
})

test('the read cloud plots on a log axis inset from the band, floored at 1000 bp', async () => {
  const { arcScale, arcSpanMax } = await scaleUnder({ mark: 'rule' })
  expect(arcScale).toMatchObject({
    band: 'arcs',
    type: 'log',
    reverse: true,
    marginPx: 0,
    insetPx: 2.5,
    domain: [1, Math.max(1000, arcSpanMax)],
  })
  expect(arcScale!.reachPx).toBe(arcScale!.heightPx)
})

test('no band, no scale', async () => {
  expect((await engine.alignments(PAIRED_INVERSION)).arcScale).toBeNull()
})
