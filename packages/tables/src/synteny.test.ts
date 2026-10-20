import { createTablesEngine } from './index.ts'
import {
  CONTIG_SWAP,
  INV_INDELS,
  INV_INDELS_DOTPLOT,
} from './synteny.fixture.ts'

const engine = createTablesEngine()

function columnsAgree(table: Record<string, unknown[]>) {
  expect(new Set(Object.values(table).map(c => c.length)).size).toBe(1)
}

test('a PAF comes back as the synteny band lays out and colors it', async () => {
  const t = await engine.synteny(INV_INDELS)
  columnsAgree(t.alignments)
  columnsAgree(t.ribbons)
  expect(t.alignments.strand).toHaveLength(7)
  expect(t.alignments.strand.filter(s => s === -1)).toHaveLength(2)
  expect(t.alignments.queryChrom).toEqual(new Array(7).fill('ctgA'))
  expect(t.assemblyNames).toEqual(['volvox_random_inv', 'volvox'])
  expect(t.hasCigar).toBe(true)
  expect(t.alpha).toBe(0.25)
  expect(t.config).toMatchObject({
    filter: [],
    cigarMode: 'full',
    drawLocationMarkers: false,
    fadeThinAlignmentsMode: 'auto',
    height: 100,
    color: { field: '' },
    opacity: { value: 0.25, field: '' },
  })

  const kinds = new Set(t.ribbons.kind)
  expect(kinds).toContain('match')
  expect(kinds).toContain('insertion')
  const zoomed = await engine.synteny({
    ...INV_INDELS,
    query: { ...INV_INDELS.query, width: 4000 },
    target: { ...INV_INDELS.target, width: 4000 },
  })
  expect(new Set(zoomed.ribbons.kind)).toContain('deletion')
  expect(zoomed.ribbons.kind.length).toBeGreaterThan(t.ribbons.kind.length)
  expect(zoomed.legend.label).toEqual(['match', 'insertion', 'deletion'])
  const matches = t.ribbons.kind
    .map((k, i) => (k === 'match' ? i : -1))
    .filter(i => i >= 0)
  expect(matches).toHaveLength(7)
  for (const i of matches) {
    const f = t.ribbons.alignment[i]!
    const reversed = t.alignments.strand[f] === -1
    expect(t.ribbons.queryStart[i]! > t.ribbons.queryEnd[i]!).toBe(reversed)
    expect(t.ribbons.targetStart[i]).toBeLessThan(t.ribbons.targetEnd[i]!)
    expect(t.ribbons.color[i]).toBe('#ff0000')
    expect(t.ribbons.alpha[i]).toBeCloseTo(0.25)
  }
  expect(t.legend.label).toEqual(['match', 'insertion'])
  expect(t.offscreen.axis).toHaveLength(0)
})

test('the CIGAR modes draw the ops colored, the matches alone, or the block alone', async () => {
  const off = await engine.synteny({
    ...INV_INDELS,
    view: { cigarMode: 'off' },
  })
  expect(new Set(off.ribbons.kind)).toEqual(new Set(['match']))
  expect(off.ribbons.kind).toHaveLength(7)
  const matches = await engine.synteny({
    ...INV_INDELS,
    view: { cigarMode: 'matches' },
  })
  expect(new Set(matches.ribbons.kind)).toEqual(new Set(['match']))
  expect(matches.ribbons.kind.length).toBeGreaterThan(7)
  expect(matches.legend.label).toEqual(['match'])
})

test('the view settings color by strand, set the opacity and hide short blocks', async () => {
  const t = await engine.synteny({
    ...INV_INDELS,
    view: {
      color: { field: 'strand' },
      opacity: 0.6,
      filter: [{ field: 'length', gte: 400 }],
      drawLocationMarkers: true,
    },
  })
  const match = t.ribbons.kind
    .map((k, i) => [k, i] as const)
    .filter(([k]) => k === 'match')
  const byStrand = new Map<number, Set<string>>()
  for (const [, i] of match) {
    const s = t.alignments.strand[t.ribbons.alignment[i]!]!
    byStrand.set(s, (byStrand.get(s) ?? new Set()).add(t.ribbons.color[i]!))
  }
  expect(byStrand.get(1)?.size).toBe(1)
  expect(byStrand.get(-1)?.size).toBe(1)
  expect(byStrand.get(1)).not.toEqual(byStrand.get(-1))
  expect(t.alpha).toBe(0.6)
  expect(match.every(([, i]) => t.ribbons.alpha[i]! > 0.59)).toBe(true)
  expect(
    new Set(t.ribbons.alignment.map(f => t.alignments.length[f]! >= 400)),
  ).toEqual(new Set([true]))
  expect(new Set(t.ribbons.alignment).size).toBe(6)
  expect(t.ribbons.kind).toContain('marker')
  expect(t.legend.label.slice(0, 2)).toEqual(['forward', 'reverse'])

  const grey = await engine.synteny({ ...INV_INDELS, view: { color: 'grey' } })
  expect(new Set(grey.alignments.color)).toEqual(new Set(['#808080']))
})

test('a block whose mate the other row does not show is listed off screen', async () => {
  const t = await engine.synteny(CONTIG_SWAP)
  expect(t.alignments.queryChrom).toEqual(['ctgA'])
  expect(t.alignments.targetChrom).toEqual(['ctgB'])
  expect(t.offscreen.axis).toHaveLength(0)
  const narrow = await engine.synteny({
    ...CONTIG_SWAP,
    target: { regions: [{ refName: 'ctgC', start: 0, end: 1000 }], width: 800 },
  })
  expect(narrow.alignments.strand).toHaveLength(0)
  expect(narrow.offscreen.axis).toEqual(['query'])
  expect(narrow.offscreen.mateChrom).toEqual(['ctgB'])
  expect(narrow.offscreen.end).toEqual([6079])
  expect(narrow.offscreen.drawn).toEqual([true])
  expect(narrow.offscreenContigs).toMatchObject({
    axis: ['query'],
    mateChrom: ['ctgB'],
    count: [1],
    alignedBp: [6079],
    label: ['ctgB · 6.08Kbp in 1 alignments'],
    color: narrow.offscreen.color,
  })
  expect(narrow.offscreen.alpha[0]).toBeCloseTo(0.35, 2)
  const { marks, labels } = narrow.offscreenStrip
  expect(marks).toMatchObject({
    axis: ['query'],
    x: [0],
    y: [0],
    height: [6],
    color: narrow.offscreen.color,
  })
  expect(marks.width[0]).toBeCloseTo((6079 / 50001) * 800)
  expect(labels).toMatchObject({ axis: ['query'], label: ['ctgB'], y: [16] })

  const below = await engine.synteny({
    ...CONTIG_SWAP,
    query: { regions: [{ refName: 'ctgC', start: 0, end: 1000 }], width: 800 },
    view: { color: { field: 'query' } },
  })
  expect(below.offscreen.axis).toEqual(['target'])
  expect(below.offscreen.chrom).toEqual(['ctgB'])
  expect(below.offscreen.mateChrom).toEqual(['ctgA'])
  expect(below.offscreen.color).not.toEqual(['#000000'])
  expect(below.offscreenContigs.axis).toEqual(['target'])
  expect(below.offscreenStrip.marks.y).toEqual([94])
  expect(below.offscreenStrip.marks.color).toEqual(below.offscreen.color)
  expect(below.offscreenStrip.labels.y).toEqual([90])
})

test('the strip names a mate contig in its ribbon color only where the ribbons key that axis', async () => {
  const narrow = {
    ...CONTIG_SWAP,
    target: {
      regions: [{ refName: 'ctgC', start: 0, end: 1000 }],
      width: 800,
    },
  }
  const grey = await engine.synteny(narrow)
  expect(grey.offscreen.color).toEqual(['#000000'])
  const byQuery = await engine.synteny({
    ...narrow,
    view: { color: { field: 'query' } },
  })
  expect(byQuery.offscreen.color).toEqual(['#000000'])
  const byTarget = await engine.synteny({
    ...narrow,
    view: { color: { field: 'target' } },
  })
  const hashed = byTarget.offscreen.color[0]
  expect(hashed).not.toBe('#000000')
  const ordered = await engine.synteny({
    ...narrow,
    view: { color: { field: 'target' } },
    target: { ...narrow.target, refNames: ['ctgC', 'ctgB'] },
  })
  const both = await engine.synteny({
    ...CONTIG_SWAP,
    view: { color: { field: 'target' } },
    target: {
      regions: [
        { refName: 'ctgC', start: 0, end: 1000 },
        { refName: 'ctgB', start: 0, end: 6079 },
      ],
      width: 800,
    },
  })
  expect(ordered.offscreen.color).toEqual([both.alignments.color[0]])
  expect(ordered.offscreen.color).not.toEqual([hashed])
  const short = await engine.synteny({
    ...narrow,
    view: { filter: [{ field: 'length', gte: 10000 }] },
  })
  expect(short.offscreen.drawn).toEqual([false])
})

test('identity keys as a ramp from 0% to 100%, and mapq as chips', async () => {
  const t = await engine.synteny({
    ...INV_INDELS,
    view: { color: { field: 'identity' } },
  })
  expect(t.legend.label).toEqual([])
  expect(t.ramps).toHaveLength(1)
  const [ramp] = t.ramps
  expect(ramp).toMatchObject({
    id: 'identity',
    title: 'Identity',
    minLabel: '0%',
    maxLabel: '100%',
  })
  expect(ramp!.offset[0]).toBe(0)
  expect(ramp!.offset.at(-1)).toBe(1)
  expect(ramp!.color).toHaveLength(ramp!.offset.length)
  expect(ramp!.opacity).toEqual(ramp!.offset.map(() => 1))

  const mapq = await engine.synteny({
    ...INV_INDELS,
    view: { color: { field: 'mapq' } },
  })
  expect(mapq.ramps).toEqual([])
  expect(mapq.legend.label.length).toBeGreaterThan(1)
  expect(t.ramps).toEqual(
    (
      await engine.dotplot({
        ...INV_INDELS_DOTPLOT,
        view: { color: { field: 'identity' } },
      })
    ).ramps,
  )
})

test('a PAF comes back as the dotplot lays out and colors it', async () => {
  const t = await engine.dotplot(INV_INDELS_DOTPLOT)
  columnsAgree(t.alignments)
  columnsAgree(t.segments)
  expect(t.alignments.strand).toHaveLength(7)
  expect(t.segments.op.length).toBeGreaterThan(7)
  expect(new Set(t.segments.op)).toContain('insertion')
  const zoomed = await engine.dotplot({
    ...INV_INDELS_DOTPLOT,
    x: { ...INV_INDELS_DOTPLOT.x, width: 4000 },
    y: { ...INV_INDELS_DOTPLOT.y, width: 4000 },
  })
  expect(new Set(zoomed.segments.op)).toContain('deletion')
  expect(new Set(t.segments.color)).toEqual(new Set(['#000000']))
  expect(t.alpha).toBe(1)
  expect(t.config).toMatchObject({
    filter: [],
    drawCigar: true,
    lineWidth: 2.5,
    opacity: { value: 1 },
  })
  for (let i = 0; i < t.alignments.strand.length; i++) {
    expect(t.alignments.xStart[i]).toBeLessThan(t.alignments.xEnd[i]!)
    expect(t.alignments.yStart[i]).toBeLessThan(t.alignments.yEnd[i]!)
  }
  const plain = await engine.dotplot({
    ...INV_INDELS_DOTPLOT,
    view: { drawCigar: false, color: { field: 'strand' } },
  })
  expect(plain.segments.op).toEqual(new Array(7).fill('match'))
  expect(new Set(plain.segments.color).size).toBe(2)
  expect(plain.legend.label.slice(0, 2)).toEqual(['forward', 'reverse'])
  expect(t.skipped.count).toBe(0)
})
