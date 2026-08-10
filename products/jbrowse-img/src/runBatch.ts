import fs from 'node:fs'
import path from 'node:path'

import { outputName, parseBedpe, recordArgv } from './batch.ts'
import { renderRegion } from './renderRegion.ts'
import { convert } from './util.ts'

import type { Opts } from './types.ts'

// Drives `renderRegion` once per BEDPE row, in-process. The module graph loads
// once for the whole callset rather than once per variant, which is the reason
// this is a subcommand and not a shell loop over `jb2export`: on a few hundred
// rows the per-process startup dominates everything else.

export interface BatchOpts extends Opts {
  bedpe: string
  outDir: string
  flank?: number
  limit?: number
  format?: 'png' | 'svg'
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
  const { bedpe, outDir, flank = 500, limit, format = 'png' } = opts
  const { records, skipped } = parseBedpe(fs.readFileSync(bedpe, 'utf8'))
  for (const reason of skipped) {
    console.warn(`Warning: skipping ${reason}`)
  }
  const selected = limit === undefined ? records : records.slice(0, limit)
  if (selected.length === 0) {
    throw new Error(`no usable junctions in ${bedpe}`)
  }
  fs.mkdirSync(outDir, { recursive: true })

  const width = opts.width ?? 1200
  const failures: { name: string; error: unknown }[] = []
  let done = 0
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
      // One line per record, so a long run shows progress and a reviewer can
      // see which row a hang is on.
      console.error(`[${idx + 1}/${selected.length}] ${name}`)
    } catch (error) {
      failures.push({ name, error })
      console.error(
        `[${idx + 1}/${selected.length}] FAILED ${name}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }
  console.error(
    `wrote ${done}/${selected.length} images to ${outDir}${
      failures.length ? `, ${failures.length} failed` : ''
    }`,
  )
  return { done, failures, skipped }
}
