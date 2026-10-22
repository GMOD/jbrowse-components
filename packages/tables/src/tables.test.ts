import { resolvePalette } from '@jbrowse/core/ui/palette'
import { cssColorToHex } from '@jbrowse/core/util/colorBits'

import { alignmentColors, createTablesEngine } from './index.ts'
import {
  BAM,
  CRAM,
  DOG_VCF,
  GFF3,
  LONG_READS,
  METHYLATED,
  OVERLAP,
  PAIRED_INVERSION,
  READ_GROUPS,
  SIGNED_BIGWIG,
  SPLICED,
} from './volvox.fixture.ts'

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

test('a read’s id is its record’s: one per read where mates share a name, and the same in another call', async () => {
  const pairs = (await engine.alignments(PAIRED_INVERSION)).reads
  expect(new Set(pairs.name).size).toBeLessThan(pairs.name.length)
  expect(new Set(pairs.id).size).toBe(pairs.id.length)
  const { reads } = await engine.alignments(BAM)
  expect(new Set(reads.id).size).toBe(reads.id.length)
  const record = (t: typeof reads, i: number) =>
    `${t.name[i]} ${t.start[i]} ${t.end[i]}`
  const recordOf = new Map(reads.id.map((id, i) => [id, record(reads, i)]))
  const later = (
    await engine.alignments({ ...BAM, region: { ...BAM.region, start: 3000 } })
  ).reads
  const shared = later.id.flatMap((id, i) =>
    recordOf.has(id) ? [[recordOf.get(id), record(later, i)]] : [],
  )
  expect(shared.length).toBeGreaterThan(100)
  for (const [before, after] of shared) {
    expect(after).toBe(before)
  }
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
    colors.insertion,
    colors.softclip,
    colors.hardclip,
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
  const inside = (p: number) => p >= BAM.region.start && p < BAM.region.end
  expect(
    mismatches.frequency.filter(
      (f, i) => f > 0 && inside(mismatches.position[i]!),
    ).length,
  ).toBe(mismatches.position.filter(p => depthAt.get(p)).length)
})

test('a key spells each color as the reads do, whatever CSS the config wrote', async () => {
  const hex = /^#[0-9a-f]{6}$/
  for (const color of [
    { field: 'tags.RG' },
    {
      field: 'strand',
      scale: { range: ['hsl(120, 100%, 25%)', 'RGB(0, 0, 255)'] },
    },
    { field: 'strand', scale: { range: ['#FF0000', '#0000FF'] } },
  ]) {
    const t = await engine.alignments({
      ...READ_GROUPS,
      display: { encoding: { color } },
    })
    const painted = new Set(t.reads.color)
    expect(t.legend.color.length).toBeGreaterThan(1)
    for (const c of [...t.legend.color, ...painted]) {
      expect(c).toMatch(hex)
    }
    for (const c of t.legend.color) {
      expect(painted).toContain(c)
    }
  }
})

test('reads paint as the display\u2019s color object paints them, with its key', async () => {
  const plain = await engine.alignments(BAM)
  expect(new Set(plain.reads.color).size).toBe(1)
  expect(plain.reads.color[0]).toMatch(/^#[0-9a-f]{6}$/)
  expect(plain.reads.category.every(c => c === 'plain')).toBe(true)
  expect(plain.legend.label).toEqual(['Reads'])

  const strand = await engine.alignments({
    ...BAM,
    display: { encoding: { color: { field: 'strand' } } },
  })
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
    display: {
      encoding: {
        color: {
          field: 'strand',
          scale: { range: ['#ff0000', '#0000ff'] },
          legend: { title: 'Mine' },
        },
      },
    },
  })
  expect([...painted(written, 1)]).toEqual(['#ff0000'])
  expect([...painted(written, -1)]).toEqual(['#0000ff'])
  expect(written.legendTitle).toBe('Mine')

  // a threshold key lists every bin, reads in it or not, highest first
  const mapq = await engine.alignments({
    ...BAM,
    display: { encoding: { color: { field: 'mapq' } } },
  })
  expect(mapq.legendTitle).toBe('Mapping quality')
  expect(mapq.legend.label[0]).toMatch(/^MAPQ 30\+/)
  expect(mapq.legend.label.length).toBe(4)
  for (const color of new Set(mapq.reads.color)) {
    expect(mapq.legend.color).toContain(color)
  }
  expect(new Set(mapq.reads.category)).toEqual(new Set(['mapq']))
  expect(mapq.ramps).toEqual([])
})

test('a ramp keys a color bar: a linear MAPQ, under the color title, and base quality', async () => {
  const t = await engine.alignments({
    ...BAM,
    display: {
      encoding: {
        color: {
          field: 'mapq',
          scale: { type: 'linear', domainMin: 0, domainMax: 30 },
        },
      },
      pileup: {
        bases: { show: true, encoding: { color: { field: 'baseQuality' } } },
      },
    },
  })
  expect(t.ramps.map(r => r.title)).toEqual(['Base quality', 'Mapping quality'])
  expect(t.legendTitle).toBe('Read colors')
  const mapq = t.ramps[1]!
  expect(mapq.minLabel).toBe('0')
  expect(mapq.maxLabel).toMatch(/^≥?30$/)
  expect(mapq.color[0]).not.toBe(mapq.color.at(-1))
  expect(mapq.color).toContain(t.reads.color[0])
  expect((await engine.alignments(BAM)).qualities.position).toHaveLength(0)
})

test('per-base quality paints each aligned base on its read through the ramp', async () => {
  const t = await engine.alignments({
    ...METHYLATED,
    display: {
      pileup: {
        bases: { show: true, encoding: { color: { field: 'baseQuality' } } },
      },
    },
  })
  const q = t.qualities
  expect(q.position.length).toBeGreaterThan(1000)
  const outside = q.position.filter((position, i) => {
    const read = q.read[i]!
    return position < t.reads.start[read]! || position >= t.reads.end[read]!
  })
  expect(outside).toEqual([])
  const colorsOf = new Map<number, Set<string>>()
  q.score.forEach((score, i) => {
    colorsOf.set(score, (colorsOf.get(score) ?? new Set()).add(q.color[i]!))
  })
  expect([...colorsOf.values()].every(colors => colors.size === 1)).toBe(true)
  const scores = [...colorsOf.keys()].sort((a, b) => a - b)
  expect(scores[0]).toBeLessThan(10)
  expect(scores.at(-1)).toBeGreaterThan(30)
  expect(colorsOf.get(scores[0]!)).not.toEqual(colorsOf.get(scores.at(-1)!))
})

test('the display\u2019s filter object keeps the reads it keeps', async () => {
  const all = await engine.alignments(BAM)
  const reverse = await engine.alignments({
    ...BAM,
    display: { filter: { flagInclude: 16 } },
  })
  expect(reverse.reads.strand.every(s => s === -1)).toBe(true)
  expect(reverse.reads.name.length).toBeGreaterThan(0)
  expect(reverse.reads.name.length).toBeLessThan(all.reads.name.length)
})

test('a mark\u2019s fade is its share of the depth, zeroed under the display\u2019s threshold', async () => {
  const { mismatches, gaps, insertions, clips } =
    await engine.alignments(LONG_READS)
  for (const table of [mismatches, gaps, insertions, clips]) {
    expect(table.fade.length).toBe(table.read.length)
    expect(table.fade.every(f => f >= 0 && f <= 1)).toBe(true)
  }
  mismatches.fade.forEach((fade, i) => {
    expect(fade).toBeLessThanOrEqual(mismatches.frequency[i]! + 1 / 255)
  })
  // sequencing errors on a 20-deep long-read pileup sit under the threshold
  expect(insertions.fade.filter(f => f === 0).length).toBeGreaterThan(0)
  expect(mismatches.fade.filter(f => f === 0).length).toBeGreaterThan(0)
  // the short reads' shared variants clear it
  const short = await engine.alignments(BAM)
  expect(short.mismatches.fade.filter(f => f > 0).length).toBeGreaterThan(0)
})

test('insertions and clips sit on their reads', async () => {
  const { reads, insertions, clips } = await engine.alignments(LONG_READS)
  expect(insertions.position.length).toBeGreaterThan(0)
  insertions.position.forEach((p, i) => {
    const r = insertions.read[i]!
    expect(p).toBeGreaterThanOrEqual(reads.start[r]!)
    expect(p).toBeLessThanOrEqual(reads.end[r]!)
    expect(insertions.length[i]).toBeGreaterThan(0)
    expect(insertions.sequence[i]).toHaveLength(insertions.length[i]!)
  })
  expect(new Set(clips.type)).toEqual(new Set(['soft', 'hard']))
  clips.type.forEach((_, i) => {
    const r = clips.read[i]!
    expect([reads.start[r], reads.end[r]]).toContain(clips.position[i])
    expect(clips.length[i]).toBeGreaterThan(0)
  })
})

test('junctions are the skips merged, each with its support', async () => {
  const { gaps, junctions } = await engine.alignments(SPLICED)
  const skips = new Set(
    gaps.type.flatMap((t, i) =>
      t === 'skip' ? [`${gaps.start[i]}-${gaps.end[i]}`] : [],
    ),
  )
  expect(junctions.start.length).toBe(skips.size)
  junctions.start.forEach((start, i) => {
    expect(skips.has(`${start}-${junctions.end[i]}`)).toBe(true)
    expect(junctions.count[i]).toBeGreaterThan(0)
    expect([1, -1, 0]).toContain(junctions.strand[i])
  })
  // the motif is read under a junction whose ends the region's sequence covers
  expect(junctions.motif.filter(Boolean).length).toBeGreaterThan(0)
  for (const m of junctions.motif) {
    expect(m === '' || m === 'non-canonical' || m.endsWith('(canonical)')).toBe(
      true,
    )
  }
  const total = junctions.count.reduce((a, b) => a + b, 0)
  expect(total).toBe(gaps.type.filter(t => t === 'skip').length)
})

test('the coverage band covers the region and no more, its reads reaching past it', async () => {
  const { region } = BAM
  const t = await engine.alignments(BAM)
  expect(Math.min(...t.reads.start)).toBeLessThan(region.start)
  expect(Math.max(...t.reads.end)).toBeGreaterThan(region.end)
  expect(t.coverage.start[0]).toBe(region.start)
  expect(t.coverage.end.at(-1)).toBe(region.end)
  expect(t.coverage.end.reduce((a, b) => Math.max(a, b), 0)).toBe(region.end)
  // each stack inside the region is the one a wider read stacks there
  const wide = await engine.alignments({
    ...BAM,
    region: { refName: 'ctgA', start: 0, end: 7000 },
  })
  const inside = (p: number) => p >= region.start && p < region.end
  for (const name of [
    'alleleCoverage',
    'interbaseCoverage',
    'indicators',
  ] as const) {
    expect(Array.from(t[name].position)).toEqual(
      Array.from(wide[name].position).filter(inside),
    )
  }
  expect(t.alleleCoverage.position.length).toBeGreaterThan(0)
})

test('a band the display hides leaves its tables empty', async () => {
  const empty = (table: Record<string, ArrayLike<unknown>>) =>
    Object.values(table).every(column => column.length === 0)
  const shown = await engine.alignments(SPLICED)
  expect(
    empty(shown.coverage) || empty(shown.reads) || empty(shown.junctions),
  ).toBe(false)
  const noCoverage = await engine.alignments({
    ...SPLICED,
    display: { coverage: { show: false } },
  })
  for (const table of [
    noCoverage.coverage,
    noCoverage.alleleCoverage,
    noCoverage.interbaseCoverage,
    noCoverage.indicators,
  ]) {
    expect(empty(table)).toBe(true)
  }
  expect(noCoverage.reads.start).toEqual(shown.reads.start)
  const noPileup = await engine.alignments({
    ...SPLICED,
    display: { pileup: { show: false }, sashimi: { show: false } },
  })
  expect(empty(noPileup.reads)).toBe(true)
  expect(empty(noPileup.gaps)).toBe(true)
  expect(empty(noPileup.junctions)).toBe(true)
  expect(noPileup.coverage.depth).toEqual(shown.coverage.depth)
})

test('pileup.mismatches.show off drops what the display drops: mismatches, insertions and deletions, not skips or clips', async () => {
  const shown = await engine.alignments(LONG_READS)
  const hidden = await engine.alignments({
    ...LONG_READS,
    display: { pileup: { mismatches: { show: false } } },
  })
  expect(shown.mismatches.position.length).toBeGreaterThan(0)
  expect(shown.insertions.position.length).toBeGreaterThan(0)
  expect(shown.gaps.type).toContain('deletion')
  expect(hidden.mismatches.position).toHaveLength(0)
  expect(hidden.insertions.position).toHaveLength(0)
  expect(hidden.gaps.type).not.toContain('deletion')
  expect(hidden.clips).toEqual(shown.clips)
  expect(hidden.reads.start).toEqual(shown.reads.start)
  const spliced = await engine.alignments(SPLICED)
  const splicedHidden = await engine.alignments({
    ...SPLICED,
    display: { pileup: { mismatches: { show: false } } },
  })
  const skips = (gaps: typeof spliced.gaps) =>
    Object.fromEntries(
      Object.entries(gaps).map(([name, column]) => [
        name,
        Array.from(column as ArrayLike<unknown>).filter(
          (_, i) => gaps.type[i] === 'skip',
        ),
      ]),
    )
  expect(spliced.gaps.type).toContain('skip')
  expect(splicedHidden.gaps).toEqual(skips(spliced.gaps))
})

test('base modifications paint under the modifications layer, keyed with the reads', async () => {
  const plain = await engine.alignments(METHYLATED)
  expect(plain.modifications.position.length).toBe(0)
  const { reads, modifications, legend } = await engine.alignments({
    ...METHYLATED,
    display: {
      pileup: {
        bases: { show: true, encoding: { color: { field: 'modifications' } } },
      },
    },
  })
  const n = modifications.position.length
  expect(n).toBeGreaterThan(100)
  for (const column of Object.values(modifications)) {
    expect(column).toHaveLength(n)
  }
  expect(new Set(modifications.type)).toEqual(new Set(['m']))
  expect(new Set(modifications.name)).toEqual(new Set(['5mC']))
  modifications.position.forEach((p, i) => {
    const r = modifications.read[i]!
    expect(p).toBeGreaterThanOrEqual(reads.start[r]!)
    expect(p).toBeLessThan(reads.end[r]!)
    expect(modifications.probability[i]).toBeGreaterThanOrEqual(0.1)
    expect(modifications.opacity[i]).toBeGreaterThanOrEqual(0.1)
    expect(modifications.opacity[i]).toBeLessThanOrEqual(1)
    expect(modifications.color[i]).toMatch(/^#[0-9a-f]{6}$/)
  })
  expect(legend.label).toContain('5mC')
  expect(new Set(reads.category)).toEqual(new Set(['modFwd', 'modRev']))

  const calls = await engine.alignments({
    ...METHYLATED,
    display: {
      pileup: {
        bases: { show: true, encoding: { color: { field: 'modifications' } } },
      },
      modifications: { unmodified: 'calls' },
    },
  })
  expect(calls.modifications.unmodified.filter(Boolean).length).toBeGreaterThan(
    0,
  )
  expect(calls.modifications.name).toContain('Unmodified 5mC')
})

test('the coverage band\u2019s stacks are the worker\u2019s: alleles, and modification states under the layer', async () => {
  const { mismatches, alleleCoverage, coverage } = await engine.alignments(BAM)
  expect(alleleCoverage.position.length).toBeGreaterThan(0)
  const sites = new Set(mismatches.position)
  const depthAt = new Map(
    Array.from(coverage.start, (s, i) => [s, coverage.depth[i]!] as const),
  )
  alleleCoverage.position.forEach((p, i) => {
    expect(sites.has(p)).toBe(true)
    expect('ACGTN').toContain(alleleCoverage.base[i])
    expect(alleleCoverage.from[i]).toBeLessThan(alleleCoverage.to[i]!)
    expect(alleleCoverage.to[i]).toBeLessThanOrEqual(1 + 1e-6)
    expect(alleleCoverage.depth[i]).toBeCloseTo(depthAt.get(p)!, 3)
  })
  const { modificationCoverage } = await engine.alignments({
    ...METHYLATED,
    display: {
      pileup: {
        bases: { show: true, encoding: { color: { field: 'modifications' } } },
      },
      modifications: { unmodified: 'calls' },
    },
  })
  expect(modificationCoverage.position.length).toBeGreaterThan(0)
  expect(new Set(modificationCoverage.color).size).toBe(2)
  modificationCoverage.from.forEach((from, i) => {
    expect(from).toBeLessThan(modificationCoverage.to[i]!)
    expect(modificationCoverage.to[i]).toBeLessThanOrEqual(1 + 1e-6)
    expect(modificationCoverage.opacity[i]).toBeGreaterThan(0)
  })
})

test('the interbase histogram counts the reads\u2019 insertions and clips, and the indicators mark where they pile up', async () => {
  const types = new Set<string>()
  let indicated = 0
  for (const fixture of [PAIRED_INVERSION, LONG_READS]) {
    const { insertions, clips, coverage, interbaseCoverage, indicators } =
      await engine.alignments(fixture)
    const expected = new Map<string, number>()
    const total = new Map<number, number>()
    const bump = (position: number, type: string) => {
      const key = `${position} ${type}`
      expected.set(key, (expected.get(key) ?? 0) + 1)
      total.set(position, (total.get(position) ?? 0) + 1)
    }
    insertions.position.forEach(p => {
      bump(p, 'insertion')
    })
    clips.position.forEach((p, i) => {
      bump(p, clips.type[i] === 'soft' ? 'softclip' : 'hardclip')
    })
    const counted = new Map<string, number>()
    const stackTop = new Map<number, number>()
    interbaseCoverage.position.forEach((p, i) => {
      const from = interbaseCoverage.from[i]!
      expect(from).toBe(stackTop.get(p) ?? 0)
      stackTop.set(p, interbaseCoverage.to[i]!)
      counted.set(
        `${p} ${interbaseCoverage.type[i]}`,
        interbaseCoverage.to[i]! - from,
      )
      types.add(interbaseCoverage.type[i]!)
    })
    expect(counted).toEqual(expected)

    // an indicator stands where the events outnumber 30% of the deeper
    // flanking depth, at 8 reads or more, in its most common type's color
    const depthAt = (bp: number) => {
      const i = coverage.start.findIndex(
        (s, j) => s <= bp && bp < coverage.end[j]!,
      )
      return i === -1 ? 0 : coverage.depth[i]!
    }
    const shown = new Set(indicators.position)
    for (const [p, n] of total) {
      const depth = Math.max(depthAt(p - 1), depthAt(p))
      expect(shown.has(p)).toBe(depth >= 8 && n > depth * 0.3)
    }
    indicators.position.forEach((p, i) => {
      const own = expected.get(`${p} ${indicators.type[i]}`)!
      for (const type of ['insertion', 'softclip', 'hardclip']) {
        expect(own).toBeGreaterThanOrEqual(expected.get(`${p} ${type}`) ?? 0)
      }
    })
    indicated += indicators.position.length
  }
  expect(types).toEqual(new Set(['insertion', 'softclip', 'hardclip']))
  expect(indicated).toBeGreaterThan(0)
})

test('the coverage band\u2019s depth axis is the display\u2019s: nice-rounded over every section, under scales.y', async () => {
  const plain = await engine.alignments(BAM)
  const peak = Math.max(...plain.coverage.depth)
  const [min, max] = plain.coverageScale.domain
  expect(min).toBe(0)
  // a 32-read peak rounds up to 35, and a 45 px band labels its two ends
  expect(peak).toBe(32)
  expect(max).toBe(35)
  expect(plain.coverageScale.ticks).toEqual([0, 35])

  const pinned = await engine.alignments({
    ...BAM,
    display: { scales: { y: { domainMax: 15 } } },
  })
  expect(pinned.coverageScale.domain).toEqual([0, 15])

  const log = await engine.alignments({
    ...BAM,
    display: { scales: { y: { type: 'log' } } },
  })
  expect(log.coverageScale.type).toBe('log')
  expect(log.coverageScale.domain[0]).toBe(1)

  // 0 asks for the constant the domain gives, which the display resolves
  const symlog = await engine.alignments({
    ...BAM,
    display: { scales: { y: { type: 'symlog', symlogConstant: 0 } } },
  })
  expect(symlog.coverageScale.symlogConstant).toBeGreaterThan(0)

  const faceted = await engine.alignments({
    ...BAM,
    display: { facet: 'strand' },
  })
  expect(faceted.sections.key.length).toBeGreaterThan(1)
  expect(faceted.coverageScale.domain[1]).toBeGreaterThanOrEqual(
    Math.max(...faceted.coverage.depth),
  )
})

test('the display\u2019s sort object orders the rows', async () => {
  const plain = await engine.alignments(BAM)
  const site = plain.mismatches.position[0]!
  const sorted = await engine.alignments({
    ...BAM,
    display: { sort: { field: 'base', pos: site } },
  })
  const rowOf = (t: typeof sorted, i: number) => t.reads.row[i]!
  const bases = new Map<number, string>()
  sorted.mismatches.position.forEach((p, i) => {
    if (p === site) {
      bases.set(sorted.mismatches.read[i]!, sorted.mismatches.base[i]!)
    }
  })
  const covering = sorted.reads.start
    .map((_, i) => i)
    .filter(i => sorted.reads.start[i]! <= site && sorted.reads.end[i]! > site)
  const mismatched = covering
    .filter(i => bases.has(i))
    .map(i => rowOf(sorted, i))
  const matching = covering
    .filter(i => !bases.has(i))
    .map(i => rowOf(sorted, i))
  expect(mismatched.length).toBeGreaterThan(0)
  expect(Math.max(...mismatched)).toBeLessThan(Math.min(...matching))

  // the length order lays the longest reads out first, by their clipped extent
  const byLength = await engine.alignments({
    ...BAM,
    display: { sort: { field: 'length' } },
  })
  const lengths = byLength.reads.start.map((s, i) => byLength.reads.end[i]! - s)
  const top = [...lengths].sort((a, b) => b - a)[
    Math.floor(lengths.length / 20)
  ]!
  const first = byLength.reads.row.indexOf(0)
  expect(lengths[first]).toBeGreaterThanOrEqual(top)
  expect(byLength.reads.row).not.toEqual(plain.reads.row)
})

test('the display’s facet object splits the reads into sections, each laid out on its own', async () => {
  const plain = await engine.alignments(BAM)
  expect(plain.sections.label).toEqual([''])
  expect(new Set(plain.reads.section)).toEqual(new Set(['']))

  const t = await engine.alignments({
    ...BAM,
    display: { facet: { field: 'strand' } },
  })
  expect(t.sections.label).toHaveLength(2)
  expect(t.reads.start).toHaveLength(plain.reads.start.length)
  const sectionOfStrand = new Map<number, string>()
  t.reads.strand.forEach((strand, i) => {
    expect(sectionOfStrand.get(strand) ?? t.reads.section[i]).toBe(
      t.reads.section[i],
    )
    sectionOfStrand.set(strand, t.reads.section[i]!)
  })
  for (const label of t.sections.label) {
    const rows = t.reads.row.filter((_, i) => t.reads.section[i] === label)
    expect(Math.min(...rows)).toBe(0)
  }
  t.mismatches.read.forEach((r, i) => {
    expect(t.reads.section[r]).toBe(t.mismatches.section[i])
    expect(t.mismatches.position[i]).toBeGreaterThanOrEqual(t.reads.start[r]!)
    expect(t.mismatches.position[i]).toBeLessThan(t.reads.end[r]!)
  })
  expect(new Set(t.coverage.section)).toEqual(new Set(t.sections.label))

  const [first, second] = t.sections.key
  const reordered = await engine.alignments({
    ...BAM,
    display: { facet: { field: 'strand', sort: [second!, first!] } },
  })
  expect(reordered.sections.key).toEqual([second, first])
  const hidden = await engine.alignments({
    ...BAM,
    display: { facet: { field: 'strand', hidden: [first!] } },
  })
  expect(hidden.sections.key).toEqual([second])
})

test('sections share one color scale, so a read paints as it does unfaceted', async () => {
  const color = { field: 'tags.NM', scale: { type: 'linear' } }
  const key = (t: { reads: { name: string[]; start: number[] } }, i: number) =>
    `${t.reads.name[i]} ${t.reads.start[i]}`
  const whole = await engine.alignments({
    ...PAIRED_INVERSION,
    display: { encoding: { color } },
  })
  const colorOf = new Map(
    whole.reads.name.map((_, i) => [key(whole, i), whole.reads.color[i]]),
  )
  const faceted = await engine.alignments({
    ...PAIRED_INVERSION,
    display: { encoding: { color }, facet: { field: 'tags.NM' } },
  })
  expect(faceted.sections.label.length).toBeGreaterThan(2)
  expect(new Set(faceted.reads.color).size).toBeGreaterThan(4)
  faceted.reads.name.forEach((_, i) => {
    expect(faceted.reads.color[i]).toBe(colorOf.get(key(faceted, i)))
  })
})

test('a key over the facet’s own field lists its values as the sections stack', async () => {
  const t = await engine.alignments({
    ...READ_GROUPS,
    display: {
      encoding: { color: { field: 'tags.RG' } },
      facet: { field: 'tags.RG', sort: ['5', '4'] },
    },
  })
  expect(t.sections.key).toEqual(['5', '4'])
  expect(t.legend.label).toEqual(['5', '4'])
})

test('settings the tables cannot serve are refused, not drawn some other way', async () => {
  const t = await engine.alignments({
    ...BAM,
    display: { facet: { field: 'strand' } },
  })
  await expect(
    engine.alignments({
      ...BAM,
      display: { facet: { field: 'strand', hidden: t.sections.key } },
    }),
  ).rejects.toThrow(/every section/)
})

test('a faceted region with no reads is one empty section, not every section hidden', async () => {
  const t = await engine.alignments({
    ...SPLICED,
    region: { refName: 'ctgA', start: 49900, end: 50001 },
    display: { facet: { field: 'strand', hidden: ['1', '-1'] } },
  })
  expect(t.sections.label).toEqual([''])
  expect(t.reads.start).toHaveLength(0)
  expect(t.coverage.depth.every(d => d === 0)).toBe(true)
})

test('a chain puts a read, its mate and its split segments on one row, joined by a line', async () => {
  const plain = await engine.alignments(PAIRED_INVERSION)
  const chained = await engine.alignments({
    ...PAIRED_INVERSION,
    display: { unit: 'chain' },
  })
  expect(plain.chains.start).toHaveLength(0)
  expect(chained.chains.color.every(c => /^#[0-9a-f]{6}$/.test(c))).toBe(true)
  expect(chained.chains.opacity[0]).toBeGreaterThan(0)
  expect(chained.reads.start).toEqual(plain.reads.start)
  const rows = new Map<string, Set<number>>()
  for (let i = 0; i < chained.reads.name.length; i++) {
    const row = rows.get(chained.reads.name[i]!) ?? new Set<number>()
    row.add(chained.reads.row[i]!)
    rows.set(chained.reads.name[i]!, row)
  }
  expect([...rows.values()].every(r => r.size === 1)).toBe(true)
  const paired = new Map<string, number[]>()
  for (let i = 0; i < chained.reads.name.length; i++) {
    const at = paired.get(chained.reads.name[i]!) ?? []
    at.push(i)
    paired.set(chained.reads.name[i]!, at)
  }
  const mates = [...paired.values()].filter(at => at.length > 1)
  expect(mates.length).toBeGreaterThan(10)
  expect(chained.chains.start).toHaveLength(mates.length)
  for (let i = 0; i < chained.chains.start.length; i++) {
    const on = mates.find(
      at => chained.reads.row[at[0]!] === chained.chains.row[i],
    )
    expect(on).toBeDefined()
  }
  const spans = new Map<number, [number, number][]>()
  for (let i = 0; i < chained.reads.name.length; i++) {
    const at = paired.get(chained.reads.name[i]!)!
    const row = chained.reads.row[i]!
    const span: [number, number] = [
      Math.min(...at.map(j => chained.reads.start[j]!)),
      Math.max(...at.map(j => chained.reads.end[j]!)),
    ]
    const list = spans.get(row) ?? []
    if (!list.some(x => x[0] === span[0] && x[1] === span[1])) {
      list.push(span)
    }
    spans.set(row, list)
  }
  for (const list of spans.values()) {
    list.sort((a, b) => a[0] - b[0])
    for (let i = 1; i < list.length; i++) {
      expect(list[i]![0]).toBeGreaterThanOrEqual(list[i - 1]![1])
    }
  }
})

test("a chain's overlapping segments come back as spans on its row, in a neutral color", async () => {
  const plain = await engine.alignments(OVERLAP)
  const chained = await engine.alignments({
    ...OVERLAP,
    display: { unit: 'chain' },
  })
  expect(plain.overlaps.start).toHaveLength(0)
  expect(chained.overlaps.start).toEqual([1100, 2150])
  expect(chained.overlaps.end).toEqual([1200, 2300])
  expect(chained.overlaps.row).toEqual(chained.chains.row)
  expect(chained.overlaps.color.every(c => /^#[0-9a-f]{6}$/.test(c))).toBe(true)
})

test('collapseSections on a faceted display is dropped with a warning, as the tables stack each section', async () => {
  const faceted = await engine.alignments({
    ...BAM,
    display: { facet: { field: 'strand' } },
  })
  const collapsed = await engine.alignments({
    ...BAM,
    display: { facet: { field: 'strand' }, collapseSections: true },
  })
  const plain = await engine.alignments({
    ...BAM,
    display: { collapseSections: true },
  })
  expect(faceted.warnings).toEqual([])
  expect(collapsed.warnings).toEqual([
    expect.stringContaining('collapseSections is dropped'),
  ])
  expect(collapsed.reads.row).toEqual(faceted.reads.row)
  expect(collapsed.overlaps.start).toHaveLength(0)
  expect(plain.warnings).toEqual([])
})

test('a chain’s overlaps and their key row come back only where the display draws them, from a 3 px read', async () => {
  const label = 'Pair/chain reads overlap here'
  const plain = await engine.alignments(OVERLAP)
  const chained = await engine.alignments({
    ...OVERLAP,
    display: { unit: 'chain' },
  })
  const thin = await engine.alignments({
    ...OVERLAP,
    display: { unit: 'chain', pileup: { readHeight: 2 } },
  })
  expect(plain.legend.label).not.toContain(label)
  const row = chained.legend.label.indexOf(label)
  expect(row).toBe(chained.legend.label.length - 1)
  expect(chained.legend.color[row]).toBe(chained.overlaps.color[0])
  expect(thin.overlaps.start).toHaveLength(0)
  expect(thin.chains.start).toEqual(chained.chains.start)
  expect(thin.legend.label).not.toContain(label)
})

test('a chain over split reads paints a read by its strand against its chain’s', async () => {
  const both = {
    ...LONG_READS,
    region: { refName: 'ctgA', start: 1000, end: 36000 },
  }
  const chained = await engine.alignments({
    ...both,
    display: { unit: 'chain', encoding: { color: { field: 'strand' } } },
  })
  const split = await engine.alignments({
    ...both,
    display: { encoding: { color: { field: 'strand' } } },
  })
  expect(chained.chains.start.length).toBeGreaterThan(0)
  expect(chained.reads.start).toEqual(split.reads.start)
  expect(new Set(chained.reads.color).size).toBeGreaterThan(1)
})

test('the glyph hands R the splice line’s fade at the read height, and the size labels’ rules', async () => {
  const tall = await engine.alignments(SPLICED)
  const compact = await engine.alignments({
    ...SPLICED,
    display: { pileup: { readHeight: 3 } },
  })
  expect(tall.glyph.intronAlpha).toBe(1)
  expect(compact.glyph.intronAlpha).toBeGreaterThan(0.25)
  expect(compact.glyph.intronAlpha).toBeLessThan(1)
  const { minHeight, digitPx, fadeLo, fadeHi, fadeFloor } = tall.glyph.label
  expect(minHeight).toBeGreaterThan(3)
  expect(digitPx).toBeGreaterThan(3)
  expect(fadeLo).toBeGreaterThan(1)
  expect(fadeHi).toBeGreaterThan(fadeLo)
  expect(fadeFloor).toBeGreaterThan(0)
  expect(fadeFloor).toBeLessThan(1)
})

test('the display’s pileup.softClips.show lays reads out by their clipped extent', async () => {
  const plain = await engine.alignments(PAIRED_INVERSION)
  const clipped = await engine.alignments({
    ...PAIRED_INVERSION,
    display: { pileup: { softClips: { show: true } } },
  })
  expect(clipped.reads.start).toEqual(plain.reads.start)
  expect(clipped.reads.row).not.toEqual(plain.reads.row)
})

test('read connections come back as the display’s band draws them', async () => {
  const off = await engine.alignments(PAIRED_INVERSION)
  expect(off.arcs.start).toHaveLength(0)
  expect(off.arcLegend.label).toEqual([])

  const arcs = await engine.alignments({
    ...PAIRED_INVERSION,
    display: { readConnections: { show: true } },
  })
  const n = arcs.arcs.start.length
  expect(n).toBeGreaterThan(100)
  for (const column of Object.values(arcs.arcs)) {
    expect(column).toHaveLength(n)
  }
  expect(new Set(arcs.arcs.shape)).toEqual(new Set(['arc']))
  expect(new Set(arcs.arcs.category)).toEqual(
    new Set(['normalInsert', 'pairLL', 'pairRR', 'splitInvLL']),
  )
  arcs.arcs.start.forEach((start, i) => {
    const radius = Math.abs(arcs.arcs.end[i]! - start) / 2
    expect(Math.abs(arcs.arcs.y[i]! - radius)).toBeLessThanOrEqual(1)
    expect(arcs.arcLegend.color).toContain(arcs.arcs.color[i])
  })
  expect(new Set(arcs.arcs.color)).toEqual(new Set(arcs.arcLegend.color))
  expect(arcs.arcLegend.label).toHaveLength(4)
  expect(arcs.arcLegendTitle).toBe('Arc colors')
  expect(new Set(arcs.arcs.width)).toEqual(new Set([1]))

  const abnormal = await engine.alignments({
    ...PAIRED_INVERSION,
    display: {
      readConnections: { show: true, ordinaryPairs: { show: false } },
    },
  })
  expect(abnormal.arcs.category).not.toContain('normalInsert')
  expect(abnormal.arcs.start).toHaveLength(
    arcs.arcs.category.filter(c => c !== 'normalInsert').length,
  )

  const cloud = await engine.alignments({
    ...PAIRED_INVERSION,
    display: { readConnections: { show: true, mark: 'rule' } },
  })
  expect(cloud.arcs.category).not.toContain('normalInsert')
  expect(new Set(cloud.arcs.shape)).toEqual(new Set(['flat', 'flatSplit']))
  expect(new Set(cloud.arcs.opacity)).toEqual(new Set([0.7]))
  cloud.arcs.span.forEach((span, i) => {
    expect(Math.abs(cloud.arcs.y[i]! - span)).toBeLessThanOrEqual(span * 0.08)
  })
  expect(cloud.arcSpanMax).toBe(Math.max(...cloud.arcs.span))
  expect(cloud.arcLegendTitle).toBe('Read cloud colors')

  const faceted = await engine.alignments({
    ...PAIRED_INVERSION,
    display: { readConnections: { show: true }, facet: { field: 'strand' } },
  })
  expect(faceted.arcs.start).toHaveLength(n)
  expect(new Set(faceted.arcs.section)).toEqual(new Set(faceted.sections.label))
})

test('an arc’s stroke widens with the reads behind it, as the band strokes it', async () => {
  const { arcs } = await engine.alignments({
    ...LONG_READS,
    display: {
      readConnections: {
        show: true,
        encoding: { strokeWidth: { field: 'reads', scale: { range: [2, 8] } } },
      },
    },
  })
  const widthAt = new Map(arcs.support.map((s, i) => [s, arcs.width[i]!]))
  expect(widthAt.get(1)).toBe(2)
  const supports = [...widthAt.keys()].sort((a, b) => a - b)
  expect(supports.length).toBeGreaterThan(1)
  for (let i = 1; i < supports.length; i++) {
    expect(widthAt.get(supports[i]!)).toBeGreaterThan(
      widthAt.get(supports[i - 1]!)!,
    )
  }
  expect(Math.max(...arcs.width)).toBeLessThanOrEqual(8)
})

test('every mark carries the color the display paints it, keyed beside the reads', async () => {
  const t = await engine.alignments(SPLICED)
  const colors = alignmentColors()
  for (const name of [
    'mismatches',
    'gaps',
    'insertions',
    'clips',
    'coverage',
    'alleleCoverage',
    'interbaseCoverage',
    'indicators',
    'junctions',
  ] as const) {
    const table = t[name] as Record<string, ArrayLike<unknown>>
    expect(table.color).toHaveLength(Object.values(table)[0]!.length)
  }
  t.mismatches.base.forEach((b, i) => {
    expect(t.mismatches.color[i]).toBe(cssColorToHex(colors.bases[b]!))
  })
  t.gaps.type.forEach((type, i) => {
    expect(t.gaps.color[i]).toBe(
      cssColorToHex(type === 'skip' ? colors.skip : colors.deletion),
    )
  })
  expect(new Set(t.coverage.color)).toEqual(
    new Set([cssColorToHex(colors.coverage)]),
  )
  expect(new Set(t.junctions.color)).toEqual(
    new Set([cssColorToHex(colors.forward)]),
  )
  expect(t.baseLegendTitle).toBe('Base')
  expect(t.baseLegend.label).toEqual(
    ['A', 'C', 'G', 'T', 'N'].filter(
      b => t.mismatches.base.includes(b) || t.alleleCoverage.base.includes(b),
    ),
  )
  t.baseLegend.label.forEach((b, i) => {
    expect(t.baseLegend.color[i]).toBe(cssColorToHex(colors.bases[b]!))
  })
  expect(t.junctionLegend).toEqual({
    label: ['Forward transcript strand'],
    color: [cssColorToHex(colors.forward)],
  })
  expect(new Set(t.interbaseLegend.color)).toEqual(
    new Set(t.interbaseCoverage.color),
  )
  expect(t.readPitch).toEqual({ featureHeight: 7, featureSpacing: 1 })
  const thin = await engine.alignments({
    ...SPLICED,
    display: { pileup: { readHeight: 3 } },
  })
  expect(thin.readPitch).toEqual({ featureHeight: 3, featureSpacing: 0 })
})

test('a modifications layer mutes every base, and the base key goes empty', async () => {
  const muted = cssColorToHex(resolvePalette().mutedSnpBase)
  for (const field of ['modifications', 'bisulfite']) {
    const t = await engine.alignments({
      ...METHYLATED,
      display: {
        pileup: {
          bases: { show: true, encoding: { color: { field } } },
        },
      },
    })
    expect(t.mismatches.color.length).toBeGreaterThan(0)
    expect(new Set(t.mismatches.color)).toEqual(new Set([muted]))
    expect(new Set(t.alleleCoverage.color)).toEqual(new Set([muted]))
    expect(t.baseLegend).toEqual({ label: [], color: [] })
  }
  const plain = await engine.alignments(METHYLATED)
  expect(plain.mismatches.color).not.toContain(muted)
  expect(plain.baseLegend.label.length).toBeGreaterThan(0)
})

test('a junction says whether the display shows it, its arc height and its stroke', async () => {
  const all = await engine.alignments(SPLICED)
  const { count } = all.junctions
  expect(all.junctions.shown.every(Boolean)).toBe(true)
  const floor = Math.max(...count)
  const t = await engine.alignments({
    ...SPLICED,
    display: { filter: { junctions: { minReads: floor } } },
  })
  expect(t.junctions.count).toEqual(count)
  expect(t.junctions.shown).toEqual(count.map(c => c >= floor))
  expect(t.junctions.shown).toContain(false)
  const hidden = await engine.alignments({
    ...SPLICED,
    display: { filter: { junctions: { nonCanonical: 'exclude' } } },
  })
  expect(hidden.junctions.shown).toEqual(
    all.junctions.motif.map(m => m !== 'non-canonical'),
  )
  const sashimiArcHeightFraction = (span: number) =>
    0.3 +
    0.65 *
      Math.min(1, Math.max(0, Math.log(span / 50) / Math.log(100_000 / 50)))
  all.junctions.start.forEach((start, i) => {
    const span = all.junctions.end[i]! - start
    expect(all.junctions.arcHeight[i]).toBeCloseTo(
      sashimiArcHeightFraction(span),
      12,
    )
    expect(all.junctions.strokeWidth[i]).toBeCloseTo(
      Math.min(16, Math.max(1, Math.log(count[i]! + 1))),
      12,
    )
  })
})

test('an allele segment is shown where its share of the depth reaches coverage.minAlleleFraction', async () => {
  const all = await engine.alignments(BAM)
  expect(all.alleleCoverage.shown.every(Boolean)).toBe(true)
  const t = await engine.alignments({
    ...BAM,
    display: { coverage: { minAlleleFraction: 0.5 } },
  })
  expect(t.alleleCoverage.shown).toEqual(
    t.alleleCoverage.from.map(
      (from, i) => t.alleleCoverage.to[i]! - from >= 0.5,
    ),
  )
  expect(t.alleleCoverage.shown).toContain(true)
  expect(t.alleleCoverage.shown).toContain(false)
})

test('config is the display’s resolved config, the slots the call set and the defaults it left', async () => {
  const t = await engine.alignments({
    ...BAM,
    display: {
      filter: { junctions: { minReads: 5 } },
      encoding: { color: { field: 'strand' } },
    },
  })
  expect(t.config.filter).toMatchObject({ junctions: { minReads: 5 } })
  expect(t.config.encoding).toMatchObject({ color: { field: 'strand' } })
  expect(t.config.coverage).toMatchObject({ height: 45, show: true })
  const display = { height: 150 }
  const others = [
    [await engine.features({ ...GFF3, display }), 'heightMode', 'fit'],
    [await engine.wiggle({ ...SIGNED_BIGWIG, display }), 'resolution', 1],
    [await engine.variants({ ...DOG_VCF, display }), 'showTree', true],
  ] as const
  for (const [tables, slot, value] of others) {
    expect(tables.config.height).toBe(150)
    expect(tables.config[slot]).toBe(value)
  }
})

test('a region of the reference reads as its bases', async () => {
  const bases = await engine.sequence({
    sequenceAdapter: BAM.sequenceAdapter,
    region: { refName: 'ctgA', start: 1000, end: 1010 },
  })
  expect(bases).toMatch(/^[ACGTNacgtn]{10}$/)
})

test('a region over the byte limit is refused before any read is fetched', async () => {
  await expect(engine.alignments({ ...BAM, byteLimit: 1000 })).rejects.toThrow(
    /over the 1000-byte limit/,
  )
})

test('a region over the span limit is refused before any read is fetched', async () => {
  await expect(engine.alignments({ ...BAM, spanLimit: 100 })).rejects.toThrow(
    /spans \d+ bp of alignments, over the 100-bp limit/,
  )
  const [whole] = (
    await engine.fileRegions({ adapterConfig: BAM.adapterConfig })
  ).refName
  await expect(
    engine.alignments({
      ...BAM,
      region: { refName: whole!, start: 0, end: 2 ** 31 - 1 },
    }),
  ).rejects.toThrow(/over the 10000000-bp limit/)
})
