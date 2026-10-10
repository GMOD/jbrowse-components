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

test('a region over the byte limit is refused before any read is fetched', async () => {
  await expect(engine.alignments({ ...BAM, byteLimit: 1000 })).rejects.toThrow(
    /over the 1000-byte limit/,
  )
})
