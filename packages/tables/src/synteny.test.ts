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
      minAlignmentLength: 400,
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
  expect(t.lineWidth).toBe(2.5)
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
