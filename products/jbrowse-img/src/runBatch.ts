import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

import { outputName, parseBedpe, recordArgv } from './batch.ts'
import { createProgress } from './progress.ts'
import { renderRegion } from './renderRegion.ts'
import { convert } from './util.ts'
import { parseVcfJunctions } from './vcfJunctions.ts'

import type { ProgressReporter } from './progress.ts'
import type { Opts } from './types.ts'

// Drives `renderRegion` once per BEDPE row, in-process. The module graph loads
// once for the whole callset rather than once per variant, which is the reason
// this is a subcommand and not a shell loop over `jb2export`: on a few hundred
// rows the per-process startup dominates everything else.

export interface BatchOpts extends Opts {
  /** BEDPE of junctions; mutually exclusive with `vcf` */
  bedpe?: string
  /** VCF (optionally bgzipped) of junctions; mutually exclusive with `bedpe` */
  vcf?: string
  outDir: string
  flank?: number
  limit?: number
  format?: 'png' | 'svg'
  /** Injected by the tests; production builds one from stderr. */
  progress?: ProgressReporter
}

// bgzip is gzip, so one check covers `.vcf.gz` and a plain `.vcf` whatever it is
// named: the magic bytes decide, not the extension. A `.vcf` that is actually
// gzipped is otherwise read as binary noise and every row is reported as
// malformed, which is a confusing way to say "this file is compressed".
function readMaybeGzip(file: string) {
  const buf = fs.readFileSync(file)
  const gzipped = buf[0] === 0x1f && buf[1] === 0x8b
  return (gzipped ? zlib.gunzipSync(buf) : buf).toString('utf8')
}

// Junctions from whichever input was given. BEDPE stays the interchange format
// (a LINX TSV, a caller this tool has never heard of, anything an awk can
// reshape); --vcf is the shortcut for what callers actually emit.
function readJunctions(opts: BatchOpts) {
  const { bedpe, vcf } = opts
  if (bedpe && vcf) {
    throw new Error('pass --bedpe or --vcf, not both')
  }
  if (vcf) {
    return parseVcfJunctions(readMaybeGzip(vcf))
  }
  if (bedpe) {
    return parseBedpe(fs.readFileSync(bedpe, 'utf8'))
  }
  throw new Error('batch needs --vcf <file> or --bedpe <file>')
}

/**
 * Render every junction in a BEDPE, one image per row.
 *
 * Keeps going after a failed row and reports the failures at the end. A callset
 * always has a row whose refName the assembly does not have, or whose window is
 * more alignment than the track will fetch, and aborting the run there means a
 * reviewer waits ten minutes to be told nothing rendered. The exit status still
 * reflects it, so a script can tell a clean run from a partial one.
 */
export async function runBatch(opts: BatchOpts) {
  const { outDir, flank = 500, limit, format = 'png' } = opts
  const source = opts.vcf ?? opts.bedpe
  const { records, skipped } = readJunctions(opts)
  // Counted rather than listed one line each: a whole-genome callset's
  // insertions are hundreds of rows, and burying the run's real output under
  // them is its own kind of silence.
  if (skipped.length > 0) {
    console.warn(
      `Warning: ${skipped.length} record(s) name no junction to draw, e.g. ${skipped[0]}`,
    )
  }
  const selected = limit === undefined ? records : records.slice(0, limit)
  if (selected.length === 0) {
    throw new Error(`no usable junctions in ${source}`)
  }
  fs.mkdirSync(outDir, { recursive: true })

  const width = opts.width ?? 1200
  const failures: { name: string; error: unknown }[] = []
  let done = 0
  const progress =
    opts.progress ??
    createProgress({
      total: selected.length,
      isTty: !!process.stderr.isTTY,
      write: s => process.stderr.write(s),
    })
  for (const [idx, rec] of selected.entries()) {
    const name = outputName(rec, idx, selected.length, format)
    const out = path.join(outDir, name)
    try {
      const svg = await renderRegion({
        ...opts,
        mode: 'breakpoint',
        width,
        // The record's own two panels REPLACE any --loc on the command line:
        // in a batch the file says where to look, and a stray --loc would
        // otherwise render the same pair of windows for every row.
        argv: [
          ...(opts.argv ?? []).filter(([key]) => key !== 'loc'),
          ...recordArgv(rec, flank),
        ],
        loc: undefined,
      })
      if (format === 'png') {
        convert(svg, { out, width: String(width) })
      } else {
        fs.writeFileSync(out, svg)
      }
      done++
      progress.step(name)
    } catch (error) {
      failures.push({ name, error })
      progress.fail(
        `FAILED ${name}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      // counted in the bar by `fail`, but the queue still advanced
      progress.step(name)
    }
  }
  progress.finish(
    `wrote ${done}/${selected.length} images to ${outDir}${
      failures.length ? `, ${failures.length} failed` : ''
    }`,
  )
  return { done, failures, skipped }
}
