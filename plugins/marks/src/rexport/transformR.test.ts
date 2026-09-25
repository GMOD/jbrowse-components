import { frame } from './rplot.ts'
import { applyTransforms } from './transformR.ts'

import type { Step } from './transformR.ts'

const base = frame({
  name: 'df',
  columns: ['start', 'end', 'score', 'strand'],
  packages: ['rtracklayer'],
  statements: 'df <- read_bigwig(path, chrom, start, end)',
})

function run(steps: Step[]) {
  const notes: string[] = []
  return { out: applyTransforms({ base, steps, notes }), notes }
}

describe('a step becomes R, and says what it now holds', () => {
  it('bins on a field into a start and an end', () => {
    const { out } = run([{ type: 'bin', step: 1000, field: 'start' }])
    expect(out.statements).toContain(
      'df$start <- floor(df$start / 1000) * 1000',
    )
    expect(out.statements).toContain('df$end <- df$start + 1000')
  })

  it('takes the bin width the display would follow the zoom with', () => {
    const { out } = run([{ type: 'bin', step: 'auto' }])
    expect(out.statements).toContain('/ 10000')
  })

  it('aggregates into the columns its ops name', () => {
    const { out } = run([
      {
        type: 'aggregate',
        groupby: ['strand'],
        ops: [
          { op: 'mean', field: 'score', as: 'meanScore' },
          { op: 'count', as: 'n' },
        ],
      },
    ])
    expect(out.statements).toContain('split(df, df[c("strand")], drop = TRUE)')
    expect(out.statements).toContain('meanScore = mean(g$score, na.rm = TRUE)')
    expect(out.statements).toContain('n = nrow(g)')
    expect(out.columns).toEqual(['strand', 'meanScore', 'n'])
  })

  it('groups an aggregate on the bin before it where none is named', () => {
    const { out } = run([
      { type: 'bin', step: 500, as: ['binStart', 'binEnd'] },
      { type: 'aggregate', ops: [{ op: 'sum', field: 'score', as: 'total' }] },
    ])
    expect(out.statements).toContain('df[c("binStart", "binEnd")]')
  })

  it('packs a pileup into rows counted from zero', () => {
    const { out } = run([{ type: 'pileup' }])
    expect(out.statements).toContain('IRanges::disjointBins(')
    expect(out.statements).toContain('- 1L')
    expect(out.columns).toContain('row')
    expect(out.packages).toContain('IRanges')
  })

  it('carries a pileup padding into the packed interval', () => {
    const { out } = run([{ type: 'pileup', padding: 2 }])
    expect(out.statements).toContain('df$end + 2')
  })

  it('replaces the frame with depth runs for a coverage step', () => {
    const { out } = run([{ type: 'coverage', as: 'depth' }])
    expect(out.statements).toContain('IRanges::coverage(')
    expect(out.columns).toEqual(['start', 'end', 'depth'])
  })

  it('runs the steps in order, each over the last one’s columns', () => {
    const { out } = run([
      { type: 'coverage', as: 'depth' },
      { type: 'bin', step: 100, field: 'start', as: ['bs', 'be'] },
    ])
    expect(out.columns).toEqual(['start', 'end', 'depth', 'bs', 'be'])
    expect(out.statements.indexOf('IRanges::coverage')).toBeLessThan(
      out.statements.indexOf('floor(df$start / 100)'),
    )
  })
})

describe('a step it cannot run is reported, never approximated', () => {
  it('says a filter left the rows in', () => {
    const { notes } = run([{ type: 'filter', expr: 'jexl:x > 1' }])
    expect(notes).toEqual([
      'transform: filter carries a jexl callback, so the figure shows unfiltered rows',
    ])
  })

  it('still gives a formula its output column, so a mark can name it', () => {
    const { out, notes } = run([{ type: 'formula', expr: 'jexl:1', as: 'v' }])
    expect(notes).toHaveLength(1)
    expect(out.columns).toContain('v')
  })

  it('says flatten and mate need structure a table lacks', () => {
    const { notes } = run([{ type: 'flatten' }, { type: 'mate' }])
    expect(notes).toEqual([
      'transform: flatten needs structure a table does not hold, not drawn',
      'transform: mate needs structure a table does not hold, not drawn',
    ])
  })
})
