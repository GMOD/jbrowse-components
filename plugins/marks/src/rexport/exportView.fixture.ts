import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import type { RExportTrack } from './exportView.ts'

export const VOLVOX = path.resolve('test_data/volvox')
export const BASE_URI = `${pathToFileURL(VOLVOX).href}/`
export const REGIONS = [{ refName: 'ctgA', start: 1000, end: 6000 }]

type Conf = Record<string, unknown> & { adapter: Record<string, unknown> }

export function configTracks(file: string) {
  const config = JSON.parse(readFileSync(path.join(VOLVOX, file), 'utf8')) as {
    tracks: (Conf & { trackId: string; name?: string; displays?: Conf[] })[]
  }
  return new Map(config.tracks.map(t => [t.trackId, t]))
}

/** An adapter config with every location under it resolved against the volvox directory, as a loaded config's are. */
function located(adapter: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...adapter }
  for (const [k, v] of Object.entries(adapter)) {
    if (k === 'uri' && typeof v === 'string') {
      out.uri = new URL(v, BASE_URI).href
    } else if (Array.isArray(v)) {
      out[k] = v.map(e =>
        e && typeof e === 'object' ? located(e as Record<string, unknown>) : e,
      )
    } else if (v && typeof v === 'object') {
      out[k] =
        'uri' in v || 'localPath' in v
          ? { ...v, baseUri: BASE_URI }
          : located(v as Record<string, unknown>)
    }
  }
  return out
}

export function track(
  source: ReturnType<typeof configTracks>,
  trackId: string,
  displayType: string,
  display: Record<string, unknown>,
): RExportTrack {
  const t = source.get(trackId)!
  return {
    trackId,
    trackName: t.name ?? trackId,
    displayType,
    adapter: located(t.adapter),
    display,
    reference: path.join(VOLVOX, 'volvox.fa'),
  }
}

/**
 * Whether a tool the R suites need is present: false skips them, except
 * under `REQUIRE_R=1`, where the R CI job sets it, so a broken install fails
 * rather than going green.
 */
export function available(tool: string, run: () => void) {
  try {
    run()
    return true
  } catch (e) {
    if (process.env.REQUIRE_R === '1') {
      throw new Error(`REQUIRE_R is set but ${tool} is unavailable: ${e}`, {
        cause: e,
      })
    }
    return false
  }
}

export function hasR(packages = ['rtracklayer', 'Rsamtools', 'ggjbrowse']) {
  return available(`R with ${packages.join(', ')}`, () => {
    execFileSync(
      'Rscript',
      ['-e', packages.map(p => `library(${p})`).join('; ')],
      { stdio: 'ignore' },
    )
  })
}

export interface RCase {
  name: string
  script: string
  /** An R expression over the script's bindings, printed as the case's result. */
  probe: string
}

/**
 * Runs every case's script in one R session, since attaching Bioconductor
 * dominates the cost, and answers each case's `probe` or the error it died
 * with.
 */
export function runCases(cases: readonly RCase[]) {
  const dir = mkdtempSync(path.join(tmpdir(), 'rexport-cases-'))
  const lines: string[] = [
    'suppressPackageStartupMessages({ library(ggplot2); library(patchwork) })',
  ]
  for (const c of cases) {
    const file = path.join(dir, `${c.name}.R`)
    writeFileSync(file, c.script)
    lines.push(
      `cat("@@", ${JSON.stringify(c.name)}, "\\t", tryCatch({
  e <- new.env(); suppressMessages(source(${JSON.stringify(file)}, local = e))
  paste(capture.output(print(with(e, ${c.probe}))), collapse = " ")
}, error = function(err) paste("ERROR:", conditionMessage(err))), "\\n", sep = "")`,
    )
  }
  const runner = path.join(dir, 'run.R')
  writeFileSync(runner, lines.join('\n'))
  const out = execFileSync('Rscript', [runner], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: 1 << 26,
  })
  const results = new Map<string, string>()
  for (const line of out.split('\n')) {
    const at = line.indexOf('@@')
    if (at >= 0) {
      const [name, ...rest] = line.slice(at + 2).split('\t')
      results.set(name!, rest.join('\t').trim())
    }
  }
  return results
}
