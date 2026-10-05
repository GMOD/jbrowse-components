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

function located(adapter: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...adapter }
  for (const [k, v] of Object.entries(adapter)) {
    if (k.endsWith('Location') && v && typeof v === 'object') {
      out[k] = { ...v, baseUri: BASE_URI }
    }
  }
  if (typeof adapter.uri === 'string') {
    out.uri = new URL(adapter.uri, BASE_URI).href
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

export function hasR() {
  try {
    execFileSync(
      'Rscript',
      ['-e', 'library(rtracklayer); library(Rsamtools)'],
      { stdio: 'ignore' },
    )
    return true
  } catch {
    return false
  }
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
