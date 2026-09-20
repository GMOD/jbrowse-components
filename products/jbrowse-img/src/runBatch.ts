import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import zlib from 'node:zlib'

import {
  eventOutputName,
  eventRecords,
  outputName,
  parseBedpe,
  recordArgv,
  recordLocs,
} from './batch.ts'
import { batchRefusedOptions, DEFAULT_WIDTH } from './options.ts'
import { createProgress } from './progress.ts'
import { resolveConfigObject } from './resolveHub.ts'
import { writeRendered } from './util.ts'
import { parseVcfJunctions } from './vcfJunctions.ts'

import type { BatchRecord } from './batch.ts'
import type { BatchFormat } from './options.ts'
import type { Entry } from './parseArgv.ts'
import type { ProgressReporter } from './progress.ts'
import type { Opts } from './types.ts'

// Drives `renderRegionReport` once per record, in-process. The module graph loads
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
  /** Processes to render in; the default is `defaultJobs` */
  jobs?: number
  /**
   * The command line that started this run, which `jobs` starts again once per
   * worker. The CLI supplies it; a library caller without one renders in
   * process.
   */
  respawn?: { command: string; args: string[] }
  /** A worker's slice of the plan: every `of`-th row from `index` */
  shard?: { index: number; of: number }
}

interface PlannedRow {
  rec: BatchRecord
  file: string
  locs: string[]
}

/** How one row ended: what a worker reports to the run that started it */
interface RowResult {
  file: string
  status: RecordStatus
  links?: string
  error?: string
}

// A render is one core's work between its own fetches, and two of them side by
// side ran at full pace each. Each holds about a gigabyte.
const ROWS_WORTH_A_WORKER = 8
const WORKER_BYTES = 2 ** 31

/** `2/8`, as a --jobs run writes a worker's slice on its command line */
export function parseShard(text?: string) {
  const m = /^(\d+)\/(\d+)$/.exec(text ?? '')
  const index = Number(m?.[1])
  const of = Number(m?.[2])
  return m && index < of ? { index, of } : undefined
}

export function defaultJobs() {
  return Math.max(
    1,
    Math.min(
      4,
      Math.floor(os.availableParallelism() / 2),
      Math.floor(os.totalmem() / WORKER_BYTES),
    ),
  )
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
  } else if (vcf) {
    return parseVcfJunctions(readMaybeGzip(vcf), { passOnly })
  } else if (bedpe) {
    if (passOnly) {
      console.warn(
        'Warning: --passOnly reads a VCF FILTER column; --bedpe has none',
      )
    }
    // a BEDPE row carries no EVENT, so no panel order is ever asked for
    return { ...parseBedpe(fs.readFileSync(bedpe, 'utf8')), refNames: [] }
  } else {
    throw new Error('batch needs --vcf <file> or --bedpe <file>')
  }
}

// A track whose index estimates too many bytes draws "Region too large to
// render" until someone presses Force load, which nobody can on a PNG: beside a
// drawn tumor panel, a gated normal reads as a locus with no supporting reads.
// A batch window is --flank wide, so loading it is bounded. Ahead of the
// track's own modifiers, so a `force:false` still wins.
function forceLoaded(tracks: Entry[] | undefined) {
  return tracks?.map(([key, [first, ...rest]]): Entry => [
    key,
    first === undefined ? [] : [first, 'force:true', ...rest],
  ])
}

/**
 * Render every record of a callset, one image per row: a breakpoint split view
 * where the record's loci need two panels, a linear view where they fit one.
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
  const supplied = new Map<string, unknown>(Object.entries(opts))
  const fixed = batchRefusedOptions.filter(key => supplied.get(key))
  if (fixed.length > 0) {
    throw new Error(
      `batch renders one view per junction, so ${fixed.map(k => `--${k}`).join(' and ')} cannot be combined with it: ${fixed.length > 1 ? 'they fix' : 'it fixes'} the view, and every row would render the same image`,
    )
  }
  const source = opts.vcf ?? opts.bedpe
  const { records, skipped, refNames } = readJunctions(opts)
  // Counted rather than listed one line each: a whole-genome callset's
  // insertions are hundreds of rows, and burying the run's real output under
  // them is its own kind of silence. Not "name no junction to draw" any more —
  // a --passOnly skip names one perfectly well and was asked to be left out.
  if (skipped.length > 0 && !opts.shard) {
    console.warn(
      `Warning: skipped ${skipped.length} record(s), e.g. ${skipped[0]}`,
    )
  }
  // An event whose loci fit two panels is the picture its records already draw:
  // GRIDSS files each breakpoint's two mates under one EVENT, and an inversion's
  // two junctions share their loci.
  const events = eventRecords(records, refNames).filter(
    e => recordLocs(e, flank).length > 2,
  )
  // Named and located up front, so `--dryRun` and the manifest report the rows
  // the loop renders. The index pads to the whole callset, so a `--limit` run
  // writes the names the full run will and `--resume` finds them.
  const planned = [
    ...records.map((rec, idx) => ({
      rec,
      file: outputName(rec, idx, records.length, format),
    })),
    ...events.map((rec, idx) => ({
      rec,
      file: eventOutputName(rec, idx, events.length, format),
    })),
  ]
    .slice(0, limit)
    .map(row => ({ ...row, locs: recordLocs(row.rec, flank) }))
  if (planned.length === 0) {
    // Which of the two emptied it: the file having nothing usable in it is a
    // different problem from `--limit 0`, and blaming the file for the flag sends
    // a reader to re-check their callset.
    throw new Error(
      records.length
        ? `--limit ${limit} selected none of the ${records.length} records in ${source}`
        : `no usable records in ${source}`,
    )
  }

  if (dryRun) {
    for (const { file, locs } of planned) {
      console.log([file, ...locs].join('\t'))
    }
    return { done: 0, failures: [], skipped }
  }

  fs.mkdirSync(outDir, { recursive: true })

  const { shard } = opts
  if (shard) {
    await renderRows(
      planned.filter((_, i) => i % shard.of === shard.index),
      opts,
      flank,
      result => {
        process.stdout.write(`${JSON.stringify(result)}\n`)
      },
    )
    return { done: 0, failures: [], skipped }
  }

  const results = new Map<string, RowResult>()
  const progress =
    opts.progress ??
    createProgress({
      total: planned.length,
      isTty: !!process.stderr.isTTY,
      write: s => {
        process.stderr.write(s)
      },
    })
  const report = (result: RowResult) => {
    results.set(result.file, result)
    const { file, status, error } = result
    progress.step(
      status === 'exists' ? `${file} (exists)` : file,
      status === 'failed' ? `FAILED ${file}: ${error}` : undefined,
    )
  }
  const jobs = Math.min(
    opts.jobs ?? defaultJobs(),
    Math.ceil(planned.length / ROWS_WORTH_A_WORKER),
  )
  await (jobs > 1 && opts.respawn
    ? renderInWorkers(planned, opts.respawn, jobs, report)
    : renderRows(planned, opts, flank, report))

  // a reused image keeps the count the run that drew it reported
  const links = opts.resume ? priorLinks(outDir) : new Map<string, string>()
  for (const { file, links: counted } of results.values()) {
    if (counted !== undefined) {
      links.set(file, counted)
    }
  }
  const status = planned.map(
    ({ file }) => results.get(file)?.status ?? 'failed',
  )
  const failures = planned
    .map(({ file }) => results.get(file))
    .filter(r => r?.status === 'failed')
    .map(r => ({ name: r!.file, error: r!.error }))
  const done = status.filter(st => st === 'ok').length
  if (opts.manifest) {
    writeManifest(outDir, planned, status, links)
  }
  // The reused count is named, or a fully-resumed run reports "wrote 0/400" and
  // reads as a run in which nothing worked.
  const reused = status.filter(st => st === 'exists').length
  progress.finish(
    `wrote ${done}/${planned.length} images to ${outDir}${
      reused ? `, ${reused} already there` : ''
    }${failures.length ? `, ${failures.length} failed` : ''}`,
  )
  return { done, failures, skipped }
}

/**
 * One process per worker, each started as this run was and told its slice. A
 * worker prints a line of JSON per row and nothing else on stdout. A row its
 * worker never reported is a worker that died, and counts as failed.
 */
function renderInWorkers(
  planned: PlannedRow[],
  respawn: { command: string; args: string[] },
  jobs: number,
  report: (result: RowResult) => void,
) {
  return Promise.all(
    Array.from(
      { length: jobs },
      (_, index) =>
        new Promise<void>(resolve => {
          const child = spawn(
            respawn.command,
            [...respawn.args, '--shard', `${index}/${jobs}`],
            { stdio: ['ignore', 'pipe', 'inherit'] },
          )
          const reported = new Set<string>()
          readline.createInterface({ input: child.stdout }).on('line', line => {
            if (line.startsWith('{')) {
              const result = JSON.parse(line) as RowResult
              reported.add(result.file)
              report(result)
            }
          })
          child.on('close', code => {
            for (const [i, { file }] of planned.entries()) {
              if (i % jobs === index && !reported.has(file)) {
                report({
                  file,
                  status: 'failed',
                  error: `its worker exited with code ${code} before rendering it`,
                })
              }
            }
            resolve()
          })
        }),
    ),
  )
}

async function renderRows(
  rows: PlannedRow[],
  opts: BatchOpts,
  flank: number,
  report: (result: RowResult) => void,
) {
  const { outDir } = opts
  // Fetched ONCE for the whole run, where it used to be once per record: a
  // --hub or a URL --config is a network round trip, and re-resolving it per
  // junction is the cost this subcommand exists to avoid. Copied per record
  // because readData mutates what it is handed.
  const configObject = await resolveConfigObject(opts)
  const width = opts.width ?? DEFAULT_WIDTH
  // Imported here, where a row is about to be drawn: a --dryRun and the process
  // that hands its rows to workers never load the render stack.
  const { setupEnv } = await import('./setupEnv.ts')
  setupEnv()
  const { renderRegionReport } = await import('./renderRegion.ts')
  for (const { rec, file, locs } of rows) {
    const out = path.join(outDir, file)
    if (opts.resume && fs.existsSync(out)) {
      report({ file, status: 'exists' })
      continue
    }
    try {
      // The record's own panels REPLACE any --loc on the command line: in a
      // batch the file says where to look, and a stray --loc would otherwise
      // render the same windows for every row.
      const argv = (opts.argv ?? []).filter(([key]) => key !== 'loc')
      const shared = {
        ...opts,
        width,
        showTracks: forceLoaded(opts.showTracks),
        trackList: forceLoaded(opts.trackList),
      }
      const rendered = await renderRegionReport(
        locs.length > 1
          ? {
              ...shared,
              mode: 'breakpoint',
              argv: [...argv, ...recordArgv(rec, flank)],
              loc: undefined,
            }
          : { ...shared, mode: 'linear', argv, loc: locs[0] },
        configObject && structuredClone(configObject),
      )
      writeRendered(rendered.svg, out, width)
      report({ file, status: 'ok', links: rendered.links?.join(',') ?? '' })
    } catch (error) {
      report({
        file,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

// A run's own index: which file is which record, under the caller's own name,
// and which rows produced no image at all. Failures otherwise exist only in the
// stderr of a run that has already scrolled past, and pairing a tumor directory
// against a normal one rests on both having produced identical row orders,
// true until a --limit or a --passOnly differs between them.
//
// `line` is the record's line in the input, the key that joins a row back to
// every column the file holds. `locs` is one locus per panel, space separated.
// An event's row has no line and its label as both name and event, so filtering
// on `event` lists the event's image above its records'. `links` is the reads
// with pieces in more than one panel, per alignments track: what a reviewer
// reads as a fan of curves, as a number a queue can be sorted on. Empty for an
// image of one panel.
const MANIFEST_COLUMNS = [
  'file',
  'locs',
  'name',
  'line',
  'event',
  'links',
  'status',
]

function priorLinks(outDir: string) {
  const file = path.join(outDir, 'manifest.tsv')
  const [head = '', ...rows] = fs.existsSync(file)
    ? fs.readFileSync(file, 'utf8').split('\n')
    : []
  const columns = head.split('\t')
  const fileAt = columns.indexOf('file')
  const linksAt = columns.indexOf('links')
  return new Map(
    fileAt === -1 || linksAt === -1
      ? []
      : rows.map(row => {
          const f = row.split('\t')
          return [f[fileAt] ?? '', f[linksAt] ?? ''] as const
        }),
  )
}

function writeManifest(
  outDir: string,
  planned: PlannedRow[],
  // index-aligned with `planned`: the loop pushes exactly one per record
  status: RecordStatus[],
  links: Map<string, string>,
) {
  const rows = planned.map(({ rec, file, locs }, i) =>
    [
      file,
      locs.join(' '),
      rec.name ?? '',
      rec.line ?? '',
      rec.event ?? '',
      links.get(file) ?? '',
      status[i],
    ].join('\t'),
  )
  fs.writeFileSync(
    path.join(outDir, 'manifest.tsv'),
    `${MANIFEST_COLUMNS.join('\t')}\n${rows.join('\n')}\n`,
  )
}
