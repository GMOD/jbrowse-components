import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import zlib from 'node:zlib'

import { comparativeRole } from '@jbrowse/launch-args'

import {
  eventOutputName,
  eventRecords,
  outputName,
  parseBedpe,
  recordAllele,
  recordSortColumn,
  recordHighlight,
  recordRows,
} from './batch.ts'
import { batchRefusedOptions, DEFAULT_WIDTH } from './options.ts'
import { createProgress } from './progress.ts'
import { resolveConfigObject } from './resolveHub.ts'
import { writeRendered } from './util.ts'
import { parseVcfJunctions } from './vcfJunctions.ts'

import type { BatchRecord } from './batch.ts'
import type { BatchFormat } from './options.ts'
import type { ProgressReporter } from './progress.ts'
import type { Opts } from './types.ts'
import type { Entry } from '@jbrowse/launch-args'

// Renders in-process so module loading and each track's index and header are
// paid once per run, not per record. That is why records keep their adapters.

export interface BatchOpts extends Opts {
  /**
   * The records to render: a VCF (optionally bgzipped), or a BEDPE when its
   * name ends `.bedpe` or `.bedpe.gz`
   */
  sites?: string
  outDir: string
  /** bp of context around each locus; the default is `recordFlank`'s */
  flank?: number
  limit?: number
  format?: BatchFormat
  /** VCF only: skip records whose FILTER is neither PASS nor `.` */
  passOnly?: boolean
  resume?: boolean
  manifest?: boolean
  dryRun?: boolean
  progress?: ProgressReporter
  jobs?: number
  /** Restarted once per worker; without it a run renders in process */
  respawn?: { command: string; args: string[] }
  /** A worker's slice of the plan: every `of`-th row from `index` */
  shard?: { index: number; of: number }
}

interface PlannedRow {
  rec: BatchRecord
  file: string
  /** the image's rows, each the windows of one contig */
  rows: string[][]
}

interface RowResult {
  file: string
  status: RecordStatus
  links?: string
  alt?: string
  spec?: string
  error?: string
}

// Records rarely revisit each other's reads, so a small decode cache suffices
const BATCH_CACHE_BYTES = 256 * 2 ** 20

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

// `exists` is a --resume skip
type RecordStatus = 'ok' | 'failed' | 'exists'

// The magic bytes decide, not the extension, since a `.vcf` may be gzipped
function readMaybeGzip(file: string) {
  const buf = fs.readFileSync(file)
  const gzipped = buf[0] === 0x1f && buf[1] === 0x8b
  return (gzipped ? zlib.gunzipSync(buf) : buf).toString('utf8')
}

function readJunctions({ sites, passOnly }: BatchOpts) {
  if (!sites) {
    throw new Error('batch needs --sites <file>: a VCF or a BEDPE')
  } else if (/\.bedpe(\.b?gz)?$/i.test(sites)) {
    if (passOnly) {
      console.warn(
        'Warning: --passOnly reads a VCF FILTER column; a BEDPE has none',
      )
    }
    // a BEDPE row carries no EVENT, so no panel order is ever asked for
    return { ...parseBedpe(readMaybeGzip(sites)), refNames: [] }
  } else {
    return parseVcfJunctions(readMaybeGzip(sites), { passOnly })
  }
}

// Force load can't be clicked on an image, and a flank-wide window is bounded.
// Ahead of the track's own modifiers, so a `force:false` still wins.
function forceLoaded(tracks: Entry[] | undefined) {
  return tracks?.map((entry): Entry =>
    comparativeRole(entry) || entry[1][0] === undefined
      ? entry
      : [entry[0], [entry[1][0], 'force:true', ...entry[1].slice(1)]],
  )
}

/**
 * One image per record: a linear view for loci on one contig, a breakpoint
 * view of one panel a contig otherwise. A failed row does not stop the run.
 */
export async function runBatch(opts: BatchOpts) {
  const { outDir, flank, limit, format = 'png', dryRun } = opts
  const supplied = new Map<string, unknown>(Object.entries(opts))
  const fixed = batchRefusedOptions.filter(key => supplied.get(key))
  if (fixed.length > 0) {
    throw new Error(
      `batch renders one view per junction, so ${fixed.map(k => `--${k}`).join(' and ')} cannot be combined with it: ${fixed.length > 1 ? 'they fix' : 'it fixes'} the view, and every row would render the same image`,
    )
  }
  const source = opts.sites
  const { records, skipped, refNames } = readJunctions(opts)
  if (skipped.length > 0 && !opts.shard) {
    console.warn(
      `Warning: skipped ${skipped.length} record(s), e.g. ${skipped[0]}`,
    )
  }
  // an event of two windows is already drawn by its own records
  const events = eventRecords(records, refNames).filter(
    e => recordRows(e, flank).flat().length > 2,
  )
  // names pad to the whole callset, so a `--limit` run matches a full one
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
    .map(row => ({ ...row, rows: recordRows(row.rec, flank) }))
  if (planned.length === 0) {
    throw new Error(
      records.length
        ? `--limit ${limit} selected none of the ${records.length} records in ${source}`
        : `no usable records in ${source}`,
    )
  }

  if (dryRun) {
    for (const { file, rows } of planned) {
      console.log([file, ...rows.flat()].join('\t'))
    }
    return { done: 0, failures: [], skipped }
  }

  fs.mkdirSync(outDir, { recursive: true })

  const { shard } = opts
  if (shard) {
    await renderRows(
      planned.filter((_, i) => i % shard.of === shard.index),
      opts,
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
  const manifestFile = path.join(outDir, MANIFEST_FILE)
  const prior = opts.resume
    ? priorResults(manifestFile)
    : new Map<string, ReportedCounts>()
  const plannedByFile = new Map(planned.map(row => [row.file, row]))
  if (opts.manifest && !(opts.resume && fs.existsSync(manifestFile))) {
    fs.writeFileSync(manifestFile, `${MANIFEST_COLUMNS.join('\t')}\n`)
  }
  const report = (reported: RowResult) => {
    const result: RowResult =
      reported.status === 'exists'
        ? { ...prior.get(reported.file), ...reported }
        : reported
    const { file, status, error } = result
    results.set(file, result)
    const row = plannedByFile.get(file)
    if (opts.manifest && row) {
      fs.appendFileSync(manifestFile, `${manifestLine(row, result)}\n`)
    }
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
    : renderRows(planned, opts, report))

  const finished = planned.map(
    ({ file }): RowResult => results.get(file) ?? { file, status: 'failed' },
  )
  const failures = finished
    .filter(r => r.status === 'failed')
    .map(r => ({ name: r.file, error: r.error }))
  const done = finished.filter(r => r.status === 'ok').length
  if (opts.manifest) {
    fs.writeFileSync(
      manifestFile,
      `${[MANIFEST_COLUMNS.join('\t'), ...planned.map((row, i) => manifestLine(row, finished[i]!))].join('\n')}\n`,
    )
  }
  const reused = finished.filter(r => r.status === 'exists').length
  progress.finish(
    `wrote ${done}/${planned.length} images to ${outDir}${
      reused ? `, ${reused} already there` : ''
    }${failures.length ? `, ${failures.length} failed` : ''}`,
  )
  return { done, failures, skipped }
}

// A worker prints one JSON line per row. A row it never reported counts as
// failed.
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
  report: (result: RowResult) => void,
) {
  const { outDir, flank } = opts
  const configObject = await resolveConfigObject(opts)
  const width = opts.width ?? DEFAULT_WIDTH
  // imported lazily so a --dryRun or a worker parent never loads the render stack
  const { setupEnv } = await import('./setupEnv.ts')
  setupEnv()
  const { decompressedBytesBudget } =
    await import('@jbrowse/core/util/cacheBudgets')
  decompressedBytesBudget.limit = BATCH_CACHE_BYTES
  const { renderRegionReport } = await import('./renderRegion.ts')
  for (const { rec, file, rows: windows } of rows) {
    const out = path.join(outDir, file)
    if (opts.resume && fs.existsSync(out)) {
      report({ file, status: 'exists' })
      continue
    }
    try {
      const argv = (opts.argv ?? []).filter(([key]) => key !== 'loc')
      const shared = {
        ...opts,
        width,
        keepAdapters: true,
        showTracks: forceLoaded(opts.showTracks),
        trackList: forceLoaded(opts.trackList),
      }
      const [only = [], ...more] = windows
      const rendered = await renderRegionReport(
        more.length === 0
          ? {
              ...shared,
              mode: 'linear',
              argv,
              loc: only.join(' '),
              joined: only.length > 1,
              sortAt: recordSortColumn(rec, flank),
              sortAllele: recordAllele(rec),
              highlight: only.length === 1 ? recordHighlight(rec) : undefined,
            }
          : {
              ...shared,
              mode: 'breakpoint',
              argv: [
                ...argv,
                ...windows.map((row): Entry => ['loc', [row.join(' ')]]),
              ],
              loc: undefined,
            },
        configObject,
      )
      // so --resume never skips an interrupted write
      const partial = path.join(outDir, `.partial-${file}`)
      writeRendered(rendered.svg, partial, width)
      fs.renameSync(partial, out)
      report({
        file,
        status: 'ok',
        links: rendered.links?.join(',') ?? '',
        alt: rendered.alt?.join(',') ?? '',
        spec: rendered.spec ? JSON.stringify(rendered.spec) : '',
      })
    } catch (error) {
      report({
        file,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

// `line` is the record's line in the input. An event's row has no line and its
// label as both name and event. `links` and `alt` are per alignments track.
const REPORTED_COLUMNS = ['links', 'alt', 'spec'] as const
type ReportedColumn = (typeof REPORTED_COLUMNS)[number]

const MANIFEST_COLUMNS = [
  'file',
  'locs',
  'name',
  'line',
  'event',
  ...REPORTED_COLUMNS,
  'status',
]

const MANIFEST_FILE = 'manifest.tsv'

type ReportedCounts = Partial<Record<ReportedColumn, string>>

// The last row per file wins, since rows are appended as records finish
function priorResults(manifestFile: string) {
  const [head = '', ...lines] = fs.existsSync(manifestFile)
    ? fs.readFileSync(manifestFile, 'utf8').split('\n')
    : []
  const columns = head.split('\t')
  const prior = new Map<string, ReportedCounts>()
  for (const line of lines) {
    const fields = line.split('\t')
    const field = (name: string) => fields[columns.indexOf(name)]
    const file = field('file')
    if (file && (field('status') === 'ok' || field('status') === 'exists')) {
      prior.set(
        file,
        Object.fromEntries(
          REPORTED_COLUMNS.map(column => [column, field(column) ?? '']),
        ),
      )
    }
  }
  return prior
}

function manifestLine({ rec, file, rows }: PlannedRow, result: RowResult) {
  return [
    file,
    rows.flat().join(' '),
    rec.name ?? '',
    rec.line ?? '',
    rec.event ?? '',
    ...REPORTED_COLUMNS.map(column => result[column] ?? ''),
    result.status,
  ].join('\t')
}
