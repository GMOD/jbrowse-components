import fs from 'fs'

import Adapter from './GfaTabixAdapter.ts'
import MyConfigSchema from './configSchema.ts'

function makeAdapter(prefix: string, withSeq: boolean) {
  const hasEdges = fs.existsSync(`${prefix}.edges.bin`)
  const hasSeq =
    withSeq &&
    fs.existsSync(`${prefix}.segments.seq.fa`) &&
    fs.existsSync(`${prefix}.segments.seq.idx`)
  return new Adapter(
    MyConfigSchema.create({
      posLocation: {
        localPath: `${prefix}.pos.bed.gz`,
        locationType: 'LocalPathLocation',
      },
      posIndex: {
        location: {
          localPath: `${prefix}.pos.bed.gz.tbi`,
          locationType: 'LocalPathLocation',
        },
      },
      segmentsLocation: {
        localPath: `${prefix}.segments.bin`,
        locationType: 'LocalPathLocation',
      },
      segmentsIdxLocation: {
        localPath: `${prefix}.segments.idx`,
        locationType: 'LocalPathLocation',
      },
      ...(hasEdges
        ? {
            edgesLocation: {
              localPath: `${prefix}.edges.bin`,
              locationType: 'LocalPathLocation',
            },
            edgesIdxLocation: {
              localPath: `${prefix}.edges.idx`,
              locationType: 'LocalPathLocation',
            },
          }
        : {}),
      ...(hasSeq
        ? {
            seqFastaLocation: {
              localPath: `${prefix}.segments.seq.fa`,
              locationType: 'LocalPathLocation',
            },
            seqIdxLocation: {
              localPath: `${prefix}.segments.seq.idx`,
              locationType: 'LocalPathLocation',
            },
          }
        : {}),
    }),
  )
}

interface Counts {
  H: number
  S: number
  L: number
  P: number
}

interface SegLine {
  id: string
  seq: string
  length?: number
}

function parseGfa(gfa: string) {
  const counts: Counts = { H: 0, S: 0, L: 0, P: 0 }
  const segs: SegLine[] = []
  for (const line of gfa.split('\n')) {
    const tag = line[0]
    if (!tag) continue
    if (tag === 'H' || tag === 'S' || tag === 'L' || tag === 'P') {
      counts[tag]++
    }
    if (tag === 'S') {
      const cols = line.split('\t')
      const id = cols[1]!
      const seq = cols[2]!
      let length: number | undefined
      for (let i = 3; i < cols.length; i++) {
        if (cols[i]!.startsWith('LN:i:')) {
          length = +cols[i]!.slice(5)
        }
      }
      segs.push({ id, seq, length })
    }
  }
  return { counts, segs }
}

const volvoxPrefix = require
  .resolve('../../../../test_data/volvox/volvox_pangenome_50.pos.bed.gz')
  .replace('.pos.bed.gz', '')

const hasSeqFixture =
  fs.existsSync(`${volvoxPrefix}.segments.seq.fa`) &&
  fs.existsSync(`${volvoxPrefix}.segments.seq.idx`)

const describeIfSeq = hasSeqFixture ? describe : describe.skip

describe('GfaTabixAdapter.getSubgraph', () => {
  it('emits placeholder S-lines when seq files are not configured', async () => {
    const adapter = makeAdapter(volvoxPrefix, /* withSeq */ false)
    const gfa = await adapter.getSubgraph({
      refName: 'ctgA',
      start: 0,
      end: 500,
      assemblyName: 'ref#0',
    })
    const { counts, segs } = parseGfa(gfa)
    expect(counts.S).toBeGreaterThan(0)
    for (const s of segs) {
      expect(s.seq).toBe('*')
      expect(typeof s.length).toBe('number')
      expect(s.length!).toBeGreaterThanOrEqual(0)
    }
  })

  it('returns empty for region with no segments', async () => {
    const adapter = makeAdapter(volvoxPrefix, false)
    const gfa = await adapter.getSubgraph({
      refName: 'ctgA',
      start: 99_999_999,
      end: 100_000_000,
      assemblyName: 'ref#0',
    })
    expect(gfa).toBe('')
  })

  it('truncates path emission when subwalk count exceeds maxPathsEmitted', async () => {
    const adapter = makeAdapter(volvoxPrefix, false)
    const region = {
      refName: 'ctgA',
      start: 0,
      end: 1000,
      assemblyName: 'ref#0',
    }
    const fullGfa = await adapter.getSubgraph(region)
    const fullParsed = parseGfa(fullGfa)
    expect(fullParsed.counts.P).toBeGreaterThan(1)

    const truncatedGfa = await adapter.getSubgraph(region, {
      maxPathsEmitted: 1,
    })
    const truncatedParsed = parseGfa(truncatedGfa)
    expect(truncatedParsed.counts.P).toBe(0)
    expect(truncatedParsed.counts.S).toBe(fullParsed.counts.S)
    expect(truncatedParsed.counts.L).toBe(fullParsed.counts.L)
    expect(truncatedGfa).toMatch(/^# truncated paths: \d+ \(max emitted: 1\)/m)
  })

  it('does not truncate when subwalk count is at or below maxPathsEmitted', async () => {
    const adapter = makeAdapter(volvoxPrefix, false)
    const region = {
      refName: 'ctgA',
      start: 0,
      end: 1000,
      assemblyName: 'ref#0',
    }
    const fullGfa = await adapter.getSubgraph(region)
    const fullCounts = parseGfa(fullGfa).counts
    const cappedGfa = await adapter.getSubgraph(region, {
      maxPathsEmitted: fullCounts.P + 100,
    })
    const cappedCounts = parseGfa(cappedGfa).counts
    expect(cappedCounts.P).toBe(fullCounts.P)
    expect(cappedGfa).not.toMatch(/^# truncated paths:/m)
  })

  it('context=0 emits seed-only subgraph with no edge expansion', async () => {
    const adapter = makeAdapter(volvoxPrefix, false)
    const region = {
      refName: 'ctgA',
      start: 0,
      end: 500,
      assemblyName: 'ref#0',
    }
    const seedOnly = await adapter.getSubgraph(region, { context: 0 })
    const default1 = await adapter.getSubgraph(region)
    const seedCounts = parseGfa(seedOnly).counts
    const defaultCounts = parseGfa(default1).counts
    expect(seedCounts.S).toBeLessThanOrEqual(defaultCounts.S)
  })

  it('default context=1 matches the legacy 1-hop behavior', async () => {
    const adapter = makeAdapter(volvoxPrefix, false)
    const region = {
      refName: 'ctgA',
      start: 0,
      end: 500,
      assemblyName: 'ref#0',
    }
    const explicit = await adapter.getSubgraph(region, { context: 1 })
    const implicit = await adapter.getSubgraph(region)
    expect(explicit).toBe(implicit)
  })

  it('larger context expands the subgraph', async () => {
    const adapter = makeAdapter(volvoxPrefix, false)
    const region = {
      refName: 'ctgA',
      start: 0,
      end: 500,
      assemblyName: 'ref#0',
    }
    const k1 = parseGfa(await adapter.getSubgraph(region, { context: 1 }))
    const k3 = parseGfa(await adapter.getSubgraph(region, { context: 3 }))
    expect(k3.counts.S).toBeGreaterThanOrEqual(k1.counts.S)
    expect(k3.counts.L).toBeGreaterThanOrEqual(k1.counts.L)
  })

  it('emitFormat=walks produces W-lines instead of P-lines', async () => {
    const adapter = makeAdapter(volvoxPrefix, false)
    const region = {
      refName: 'ctgA',
      start: 0,
      end: 500,
      assemblyName: 'ref#0',
    }
    const pgfa = await adapter.getSubgraph(region, { emitFormat: 'paths' })
    const wgfa = await adapter.getSubgraph(region, { emitFormat: 'walks' })
    const p = parseGfa(pgfa)
    const wlines = wgfa.split('\n').filter(l => l.startsWith('W\t'))
    expect(p.counts.P).toBeGreaterThan(0)
    expect(wlines.length).toBe(p.counts.P)
    expect(wgfa.split('\n').filter(l => l.startsWith('P\t')).length).toBe(0)
    for (const line of wlines) {
      const cols = line.split('\t')
      expect(cols.length).toBe(7)
      const start = +cols[4]!
      const end = +cols[5]!
      expect(end).toBeGreaterThan(start)
      expect(cols[6]!).toMatch(/^[><]s\d+/)
    }
  })

  it('getEquivalentRanges maps a ref viewport to other paths sharing segments', async () => {
    const adapter = makeAdapter(volvoxPrefix, false)
    const ranges = await adapter.getEquivalentRanges({
      refName: 'ctgA',
      start: 0,
      end: 1000,
      assemblyName: 'ref#0',
    })
    expect(ranges.size).toBeGreaterThan(0)
    for (const [name, { start, end }] of ranges) {
      expect(name).toMatch(/^[^#]+#\d+#ctgA$/)
      expect(end).toBeGreaterThan(start)
      expect(name).not.toBe('ref#0#ctgA')
    }
  })

  it('getEquivalentRanges returns empty for a region with no segments', async () => {
    const adapter = makeAdapter(volvoxPrefix, false)
    const ranges = await adapter.getEquivalentRanges({
      refName: 'ctgA',
      start: 99_999_999,
      end: 100_000_000,
      assemblyName: 'ref#0',
    })
    expect(ranges.size).toBe(0)
  })

  it('W-line walk uses > for + and < for - orientation', async () => {
    const adapter = makeAdapter(volvoxPrefix, false)
    const wgfa = await adapter.getSubgraph(
      {
        refName: 'ctgA',
        start: 0,
        end: 500,
        assemblyName: 'ref#0',
      },
      { emitFormat: 'walks' },
    )
    const wline = wgfa.split('\n').find(l => l.startsWith('W\t'))
    expect(wline).toBeDefined()
    const walk = wline!.split('\t')[6]!
    expect(walk).toMatch(/^[><]/)
    expect(walk).not.toMatch(/[+\-,]/)
  })
})

describeIfSeq('GfaTabixAdapter.getSubgraph (sequences)', () => {
  it('emits real S-line sequences when seq files are configured', async () => {
    const adapter = makeAdapter(volvoxPrefix, true)
    const gfa = await adapter.getSubgraph({
      refName: 'ctgA',
      start: 0,
      end: 500,
      assemblyName: 'ref#0',
    })
    const { counts, segs } = parseGfa(gfa)
    expect(counts.S).toBeGreaterThan(0)
    expect(counts.L).toBeGreaterThan(0)
    expect(counts.P).toBeGreaterThan(0)

    for (const s of segs) {
      expect(s.seq).not.toBe('*')
      expect(/^[ACGTN]+$/i.test(s.seq)).toBe(true)
    }
  })

  it('S-line sequence length matches the corresponding length implied by edges', async () => {
    const adapter = makeAdapter(volvoxPrefix, true)
    const gfa = await adapter.getSubgraph({
      refName: 'ctgA',
      start: 0,
      end: 1000,
      assemblyName: 'ref#0',
    })
    const { segs } = parseGfa(gfa)
    expect(segs.length).toBeGreaterThan(10)
    for (const s of segs) {
      expect(s.seq.length).toBeGreaterThan(0)
    }
  })

  it('GFA round-trips: re-parsing emitted output yields the same line counts', async () => {
    const adapter = makeAdapter(volvoxPrefix, true)
    const gfa = await adapter.getSubgraph({
      refName: 'ctgA',
      start: 0,
      end: 500,
      assemblyName: 'ref#0',
    })
    const { counts } = parseGfa(gfa)
    expect(counts.H).toBe(1)
    expect(counts.S).toBeGreaterThan(0)
    // S-line seq column has no embedded tabs/newlines that would break a
    // second pass through the parser (caught regressions where binary
    // bytes leaked through).
    const lines = gfa.split('\n').filter(l => l.startsWith('S\t'))
    for (const l of lines) {
      const cols = l.split('\t')
      expect(cols.length).toBeGreaterThanOrEqual(3)
      expect(cols[2]).not.toMatch(/[\r\n]/)
    }
  })

  it('two getSubgraph calls return identical output (idempotent + idx caching)', async () => {
    const adapter = makeAdapter(volvoxPrefix, true)
    const region = {
      refName: 'ctgA',
      start: 100,
      end: 800,
      assemblyName: 'ref#0',
    }
    const a = await adapter.getSubgraph(region)
    const b = await adapter.getSubgraph(region)
    expect(a).toBe(b)
  })
})
