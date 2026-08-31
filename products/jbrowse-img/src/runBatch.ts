import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

import { outputName, parseBedpe, recordArgv, recordLocs } from './batch.ts'
import { DEFAULT_WIDTH } from './options.ts'
import { createProgress } from './progress.ts'
import { renderRegion } from './renderRegion.ts'
import { resolveConfigObject } from './resolveHub.ts'
import { writeRendered } from './util.ts'
import { parseVcfJunctions } from './vcfJunctions.ts'

import type { BatchFormat } from './options.ts'
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
  format?: BatchFormat
  /** VCF only: skip records whose FILTER is neither PASS nor `.` */
  passOnly?: boolean
  /** Skip a record whose image is already in `outDir` */
  resume?: boolean
  /** Also write `manifest.tsv` */
  manifest?: boolean
  /** Print what would render, render nothing */
  dryRun?: boolean
  /** Injected by the tests; production builds one from stderr. */
  progress?: ProgressReporter
}

// How one record ended, as the manifest reports it. `exists` is a --resume skip,
// i.e. an image an earlier run already produced.
type RecordStatus = 'ok' | 'failed' | 'exists'

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
  const { bedpe, vcf, passOnly } = opts
  if (bedpe && vcf) {
    throw new Error('pass --bedpe or --vcf, not both')
  }
  if (vcf) {
    return parseVcfJunctions(readMaybeGzip(vcf), { passOnly })
  }
  if (bedpe) {
    if (passOnly) {
      console.warn(
        'Warning: --passOnly reads a VCF FILTER column; --bedpe has none',
      )
    }
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
  const { outDir, flank = 500, limit, format = 'png', dryRun } = opts
  // A batch draws the view its junction file describes, so a flag that FIXES the
  // view cannot also be honored — `renderBreakpoint` prefers a spec over the
  // per-record panels, and `addLaunchView` adopts a session's view of the same
  // type. Refused rather than ignored, because the failure is silent and looks
  // like success: N identical images under N filenames each naming a different
  // junction, and a `wrote N/N` to finish.
  const fixed = (['spec', 'session'] as const).filter(key => opts[key])
  if (fixed.length > 0) {
    throw new Error(
      `batch renders one view per junction, so ${fixed.map(k => `--${k}`).join(' and ')} cannot be combined with it: ${fixed.length > 1 ? 'they fix' : 'it fixes'} the view, and every row would render the same image`,
    )
  }
  const source = opts.vcf ?? opts.bedpe
  const { records, skipped } = readJunctions(opts)
  // Counted rather than listed one line each: a whole-genome callset's
  // insertions are hundreds of rows, and burying the run's real output under
  // them is its own kind of silence. Not "name no junction to draw" any more —
  // a --passOnly skip names one perfectly well and was asked to be left out.
  if (skipped.length > 0) {
    console.warn(
      `Warning: skipped ${skipped.length} record(s), e.g. ${skipped[0]}`,
    )
  }
  const selected = limit === undefined ? records : records.slice(0, limit)
  if (selected.length === 0) {
    // Which of the two emptied it: the file having nothing usable in it is a
    // different problem from `--limit 0`, and blaming the file for the flag sends
    // a reader to re-check their callset.
    throw new Error(
      records.length
        ? `--limit ${limit} selected none of the ${records.length} junctions in ${source}`
        : `no usable junctions in ${source}`,
    )
  }

  // Name and locate every record up front, so `--dryRun` and the manifest report
  // the same rows the loop renders rather than a second derivation of them.
  const planned = selected.map((rec, idx) => ({
    rec,
    file: outputName(rec, idx, selected.length, format),
    locs: recordLocs(rec, flank),
  }))

  if (dryRun) {
    for (const { file, locs } of planned) {
      console.log([file, ...locs].join('\t'))
    }
    return { done: 0, failures: [], skipped }
  }

  fs.mkdirSync(outDir, { recursive: true })

  // Fetched ONCE for the whole run, where it used to be once per record: a
  // --hub or a URL --config is a network round trip, and re-resolving it per
  // junction is the cost this subcommand exists to avoid. Copied per record
  // because readData mutates what it is handed.
  const configObject = await resolveConfigObject(opts)
  const width = opts.width ?? DEFAULT_WIDTH
  const failures: { name: string; error: unknown }[] = []
  const status: RecordStatus[] = []
  let done = 0
  const progress =
    opts.progress ??
    createProgress({
      total: planned.length,
      isTty: !!process.stderr.isTTY,
      write: s => {
        process.stderr.write(s)
      },
    })
  for (const { rec, file } of planned) {
    const out = path.join(outDir, file)
    if (opts.resume && fs.existsSync(out)) {
      status.push('exists')
      progress.step(`${file} (exists)`)
      continue
    }
    try {
      const svg = await renderRegion(
        {
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
        },
        configObject && structuredClone(configObject),
      )
      writeRendered(svg, out, width)
      done++
      status.push('ok')
      progress.step(file)
    } catch (error) {
      failures.push({ name: file, error })
      status.push('failed')
      progress.step(
        file,
        `FAILED ${file}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }
  if (opts.manifest) {
    writeManifest(outDir, planned, status)
  }
  // The reused count is named, or a fully-resumed run reports "wrote 0/400" and
  // reads as a run in which nothing worked.
  const reused = status.filter(s => s === 'exists').length
  progress.finish(
    `wrote ${done}/${planned.length} images to ${outDir}${
      reused ? `, ${reused} already there` : ''
    }${failures.length ? `, ${failures.length} failed` : ''}`,
  )
  return { done, failures, skipped }
}

// A run's own index, so the directory is reviewable as the contact sheet the
// workflow calls it: which file is which junction, under the caller's own name,
// and which rows produced no image at all. Failures otherwise exist only in the
// stderr of a run that has already scrolled past, and pairing a tumor directory
// against a normal one rests on both having produced identical row orders —
// true, until a --limit or a --passOnly differs between them.
function writeManifest(
  outDir: string,
  planned: { rec: { name?: string }; file: string; locs: string[] }[],
  // index-aligned with `planned`: the loop pushes exactly one per record
  status: RecordStatus[],
) {
  const rows = planned.map(({ rec, file, locs }, i) =>
    [file, ...locs, rec.name ?? '', status[i]].join('\t'),
  )
  fs.writeFileSync(
    path.join(outDir, 'manifest.tsv'),
    `${['file', 'loc1', 'loc2', 'name', 'status'].join('\t')}\n${rows.join('\n')}\n`,
  )
}
