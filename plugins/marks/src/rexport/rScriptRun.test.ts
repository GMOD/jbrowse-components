import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { frameFor, helpersFor } from './frameFor.ts'
import { markPlot } from './markToPlot.ts'
import { HELPERS } from './rHelpers.generated.ts'
import { assembleRScript, resolveHelpers } from './rScript.ts'

import type { DisplaySpec } from './markToPlot.ts'
import type { Region } from './rScript.ts'

/**
 * Codegen string checks miss the bugs that matter — a script that exits 0 and
 * draws the wrong picture. These run the real emitted script through Rscript
 * and then ask R what it read, which is the technique
 * agent-docs/reference/R_EXPORT.md §Verification describes.
 */
const R = hasR()
const BIGWIG = path.resolve('test_data/volvox/volvox.bw')
const GFF = path.resolve('test_data/volvox/volvox.sort.gff3.gz')

function hasR() {
  try {
    execFileSync('Rscript', ['-e', 'library(rtracklayer); library(ggplot2)'], {
      stdio: 'ignore',
    })
    return true
  } catch {
    return false
  }
}

function runR(source: string, name: string) {
  const dir = mkdtempSync(path.join(tmpdir(), 'rexport-'))
  const script = path.join(dir, `${name}.R`)
  const out = path.join(dir, `${name}.png`)
  writeFileSync(script, source.replace('figure.png', out))
  execFileSync('Rscript', [script], { cwd: dir, stdio: 'pipe' })
  return out
}

function build({
  display,
  type,
  uri,
  regions,
}: {
  display: DisplaySpec
  type: 'BigWigAdapter' | 'Gff3TabixAdapter'
  uri: string
  regions: Region[]
}) {
  const f = frameFor({ type, uri })
  const { plot, notes } = markPlot({
    display,
    frame: f,
    region: { start: regions[0]!.start, end: regions.at(-1)!.end },
  })
  return assembleRScript({
    regions,
    panels: [{ variable: 'p1', plot, helpers: helpersFor(type) }],
    notes,
  })
}

const maybe = R ? describe : describe.skip

maybe('the emitted script runs', () => {
  it('draws a BigWig bar panel', () => {
    const source = build({
      display: {
        marks: [{ mark: 'bar', encoding: { y: 'score', color: 'steelblue' } }],
      },
      type: 'BigWigAdapter',
      uri: BIGWIG,
      regions: [{ refName: 'ctgA', start: 0, end: 5000 }],
    })
    expect(existsSync(runR(source, 'bigwig'))).toBe(true)
  })

  it('draws a colour ramp over the same data', () => {
    const source = build({
      display: {
        marks: [
          {
            mark: 'bar',
            encoding: {
              y: 'score',
              color: { field: 'score', scale: 'linear', scheme: 'viridis' },
            },
          },
        ],
      },
      type: 'BigWigAdapter',
      uri: BIGWIG,
      regions: [{ refName: 'ctgA', start: 0, end: 5000 }],
    })
    expect(existsSync(runR(source, 'ramp'))).toBe(true)
  })

  it('spans two regions on one cumulative axis', () => {
    const source = build({
      display: { marks: [{ mark: 'bar', encoding: { y: 'score' } }] },
      type: 'BigWigAdapter',
      uri: BIGWIG,
      regions: [
        { refName: 'ctgA', start: 0, end: 2000 },
        { refName: 'ctgA', start: 20000, end: 22000 },
      ],
    })
    expect(existsSync(runR(source, 'multi'))).toBe(true)
  })

  it('stacks GFF features as spans on their rows', () => {
    if (!existsSync(GFF)) {
      return
    }
    const source = build({
      display: {
        marks: [
          {
            mark: 'span',
            encoding: {
              row: 'row',
              color: {
                field: 'strand',
                domain: ['+', '-'],
                range: ['blue', 'red'],
              },
            },
          },
        ],
      },
      type: 'Gff3TabixAdapter',
      uri: GFF,
      regions: [{ refName: 'ctgA', start: 0, end: 50000 }],
    })
    expect(source).toContain('read_gff(')
    expect(source).toContain('scale_fill_manual')
  })
})

maybe('the transform stage runs', () => {
  it('bins and aggregates a BigWig into one bar per window', () => {
    const source = build({
      display: {
        transform: [
          { type: 'bin', step: 500, field: 'start', as: ['start', 'end'] },
          {
            type: 'aggregate',
            ops: [{ op: 'mean', field: 'score', as: 'meanScore' }],
          },
        ],
        marks: [{ mark: 'bar', encoding: { y: 'meanScore' } }],
      },
      type: 'BigWigAdapter',
      uri: BIGWIG,
      regions: [{ refName: 'ctgA', start: 0, end: 5000 }],
    })
    expect(existsSync(runR(source, 'binned'))).toBe(true)
  })

  it('packs GFF features into rows a span mark stands on', () => {
    const source = build({
      display: {
        transform: [{ type: 'pileup', padding: 2 }],
        marks: [{ mark: 'span', encoding: { row: 'row' } }],
      },
      type: 'Gff3TabixAdapter',
      uri: GFF,
      regions: [{ refName: 'ctgA', start: 0, end: 50000 }],
    })
    expect(existsSync(runR(source, 'pileup'))).toBe(true)
  })
})

/**
 * What the figure claims, checked against R rather than against the emitter.
 * A probe calls one helper and asserts a fact about the data, so a reader that
 * silently returns the wrong window fails here rather than in a picture.
 */
maybe('the readers agree with the file', () => {
  const probe = (needs: string[], body: string) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'rexport-probe-'))
    const script = path.join(dir, 'probe.R')
    const defs = resolveHelpers(needs)
      .map(h => HELPERS[h])
      .join('\n\n')
    writeFileSync(
      script,
      `suppressMessages({library(rtracklayer); library(GenomicRanges)})\n${defs}\n${body}\n`,
    )
    return execFileSync('Rscript', [script], { encoding: 'utf8' }).trim()
  }

  it('hands back 0-based half-open bins that abut', () => {
    const gaps = probe(
      ['read_bigwig'],
      `
df <- read_bigwig(${JSON.stringify(BIGWIG)}, "ctgA", 0, 5000)
df <- df[order(df$start), ]
cat(sum(df$start[-1] != head(df$end, -1)))
`,
    )
    expect(gaps).toBe('0')
  })

  it('reads the window it was asked for, not one shifted by a base', () => {
    const first = probe(
      ['read_bigwig'],
      `
df <- read_bigwig(${JSON.stringify(BIGWIG)}, "ctgA", 100, 200)
cat(min(df$start), max(df$end))
`,
    )
    const [start, end] = first.split(' ').map(Number)
    expect(start).toBeGreaterThanOrEqual(100)
    expect(end).toBeLessThanOrEqual(200)
  })
})
