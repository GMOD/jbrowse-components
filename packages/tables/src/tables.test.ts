import { alignmentColors, createTablesEngine } from './index.ts'
import { BAM, CRAM } from './volvox.fixture.ts'

const engine = createTablesEngine()

test('a BAM region comes back as the display lays it out', async () => {
  const { reads, mismatches, gaps, coverage } = await engine.alignments(BAM)
  const n = reads.start.length
  expect(n).toBe(982)
  for (const column of Object.values(reads)) {
    expect(column).toHaveLength(n)
  }
  // no two reads on one row overlap, the pileup's packing
  const byRow = new Map<number, [number, number][]>()
  for (let i = 0; i < n; i++) {
    const row = byRow.get(reads.row[i]!) ?? []
    row.push([reads.start[i]!, reads.end[i]!])
    byRow.set(reads.row[i]!, row)
  }
  for (const spans of byRow.values()) {
    spans.sort((a, b) => a[0] - b[0])
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i]![0]).toBeGreaterThanOrEqual(spans[i - 1]![1])
    }
  }
  // every mismatch and gap sits inside the read it names
  for (let i = 0; i < mismatches.position.length; i++) {
    const r = mismatches.read[i]!
    expect(mismatches.position[i]).toBeGreaterThanOrEqual(reads.start[r]!)
    expect(mismatches.position[i]).toBeLessThan(reads.end[r]!)
  }
  expect(new Set(mismatches.base)).toEqual(new Set(['A', 'C', 'G', 'T']))
  expect(gaps.type.every(t => t === 'deletion')).toBe(true)
  expect(Math.max(...coverage.depth)).toBeGreaterThan(20)
})

test('a CRAM gives the tables its BAM gives', async () => {
  const [bam, cram] = await Promise.all([
    engine.alignments(BAM),
    engine.alignments(CRAM),
  ])
  const reads = (t: typeof bam) =>
    t.reads.name.map(
      (name, i) =>
        `${name} ${t.reads.start[i]} ${t.reads.end[i]} ${t.reads.row[i]}`,
    )
  const mismatches = (t: typeof bam) =>
    Array.from(
      t.mismatches.position,
      (p, i) =>
        `${p} ${t.mismatches.base[i]} ${t.reads.name[t.mismatches.read[i]!]}`,
    ).sort()
  expect(reads(cram).sort()).toEqual(reads(bam).sort())
  expect(mismatches(cram)).toEqual(mismatches(bam))
})

test('the colors are the display\u2019s, one per base', () => {
  const colors = alignmentColors()
  expect(Object.keys(colors.bases).sort()).toEqual(['A', 'C', 'G', 'N', 'T'])
  for (const color of [
    colors.read,
    colors.skip,
    colors.deletion,
    colors.coverage,
  ]) {
    expect(color).toMatch(/^(#|rgb)/)
  }
})

test('a mismatch\u2019s frequency is its base\u2019s share of the depth there', async () => {
  const { mismatches, coverage } = await engine.alignments(BAM)
  const count = new Map<string, number>()
  mismatches.position.forEach((p, i) => {
    const k = `${p} ${mismatches.base[i]}`
    count.set(k, (count.get(k) ?? 0) + 1)
  })
  const depthAt = new Map(
    Array.from(coverage.start, (s, i) => [s, coverage.depth[i]!] as const),
  )
  mismatches.position.forEach((p, i) => {
    const depth = depthAt.get(p)
    if (depth) {
      expect(mismatches.frequency[i]).toBeCloseTo(
        Math.min(1, count.get(`${p} ${mismatches.base[i]}`)! / depth),
      )
    }
  })
  expect(mismatches.frequency.filter(f => f > 0).length).toBe(
    mismatches.position.filter(p => depthAt.get(p)).length,
  )
})

test('reads paint as the display\u2019s color object paints them, with its key', async () => {
  const plain = await engine.alignments(BAM)
  expect(new Set(plain.reads.color).size).toBe(1)
  expect(plain.reads.color[0]).toMatch(/^#[0-9a-f]{6}$/)
  expect(plain.reads.category.every(c => c === 'plain')).toBe(true)
  expect(plain.legend.label).toEqual(['Reads'])

  const strand = await engine.alignments({ ...BAM, color: { field: 'strand' } })
  const painted = (t: typeof strand, s: number) =>
    new Set(t.reads.color.filter((_, i) => t.reads.strand[i] === s))
  const [fwd] = painted(strand, 1)
  const [rev] = painted(strand, -1)
  expect(painted(strand, 1).size).toBe(1)
  expect(painted(strand, -1).size).toBe(1)
  expect(fwd).not.toEqual(rev)
  expect(new Set(strand.reads.category)).toEqual(
    new Set(['fwdStrand', 'revStrand']),
  )
  expect(strand.legend).toEqual({
    label: ['Forward strand', 'Reverse strand'],
    color: [fwd, rev],
  })
  expect(strand.legendTitle).toBe('Read colors')

  const written = await engine.alignments({
    ...BAM,
    color: { field: 'strand', range: ['#ff0000', '#0000ff'], title: 'Mine' },
  })
  expect([...painted(written, 1)]).toEqual(['#ff0000'])
  expect([...painted(written, -1)]).toEqual(['#0000ff'])
  expect(written.legendTitle).toBe('Mine')

  // a threshold key lists every bin, reads in it or not, highest first
  const mapq = await engine.alignments({ ...BAM, color: { field: 'mapq' } })
  expect(mapq.legendTitle).toBe('Mapping quality')
  expect(mapq.legend.label[0]).toMatch(/^MAPQ 30\+/)
  expect(mapq.legend.label.length).toBe(4)
  for (const color of new Set(mapq.reads.color)) {
    expect(mapq.legend.color).toContain(color)
  }
  expect(new Set(mapq.reads.category)).toEqual(new Set(['mapq']))
})

test('the display\u2019s filter object keeps the reads it keeps', async () => {
  const all = await engine.alignments(BAM)
  const reverse = await engine.alignments({
    ...BAM,
    filter: { flagInclude: 16 },
  })
  expect(reverse.reads.strand.every(s => s === -1)).toBe(true)
  expect(reverse.reads.name.length).toBeGreaterThan(0)
  expect(reverse.reads.name.length).toBeLessThan(all.reads.name.length)
})

test('a region over the byte limit is refused before any read is fetched', async () => {
  await expect(engine.alignments({ ...BAM, byteLimit: 1000 })).rejects.toThrow(
    /over the 1000-byte limit/,
  )
})
