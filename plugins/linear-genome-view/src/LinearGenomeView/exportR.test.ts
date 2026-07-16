import { assembleRScript, resolveHelpers } from './exportR.ts'
import { HELPERS } from './rHelpers.generated.ts'

import type { RTrackFragment } from './types.ts'

/** The R code of a helper: its definition with comment-only lines removed, so
 * a helper merely *named in prose* ("the same primitive pileup_layout uses")
 * isn't mistaken for a call. */
function helperCode(name: string) {
  return HELPERS[name]!.split('\n')
    .filter(line => !/^\s*#/.test(line))
    .join('\n')
}

/** Helpers whose code `name` actually calls. */
function calledHelpers(name: string) {
  return Object.keys(HELPERS).filter(
    other =>
      other !== name && new RegExp(`\\b${other}\\b`).test(helperCode(name)),
  )
}

// The invariant behind HELPER_DEPS: a fragment declares only the helpers its own
// plot code calls, and assembleRScript closes over helper-to-helper calls. If a
// helper gains a call to another one and the edge isn't declared, the emitted
// script references an undefined function — R fails at run time, deep inside a
// generated file. This catches it at build time instead.
test.each(Object.keys(HELPERS))('%s declares the helpers it calls', name => {
  expect([...resolveHelpers([name])]).toEqual(
    expect.arrayContaining(calledHelpers(name)),
  )
})

test('resolveHelpers pulls in transitive calls', () => {
  // read_multibigwig calls read_bigwig; mismatch_fade_alpha calls
  // snp_freq_threshold. A caller declares neither.
  expect(resolveHelpers(['read_multibigwig'])).toEqual(
    new Set(['read_multibigwig', 'read_bigwig']),
  )
  expect(resolveHelpers(['mismatch_fade_alpha'])).toEqual(
    new Set(['mismatch_fade_alpha', 'snp_freq_threshold']),
  )
})

const region = { refName: 'ctgA', start: 0, end: 100 }

function fragment(helpers: string[]): RTrackFragment {
  return {
    trackId: 'track1',
    trackName: 'Track 1',
    packages: ['rtracklayer', 'ggplot2'],
    helpers,
    setup: 'bw <- "volvox.bw"',
    plotVariable: 'p_track1',
    plotExpr: 'ggplot()',
  }
}

test('a fragment gets its helpers definitions, closed over their calls', () => {
  const script = assembleRScript(region, [fragment(['read_multibigwig'])])
  expect(script).toContain('read_multibigwig <- function')
  expect(script).toContain('read_bigwig <- function')
})

test('unreferenced helpers are left out', () => {
  const script = assembleRScript(region, [fragment(['read_bigwig'])])
  expect(script).toContain('read_bigwig <- function')
  expect(script).not.toContain('read_multibigwig <- function')
  expect(script).not.toContain('hic_triangle <- function')
})

test('helper defs are emitted once, before the code that calls them', () => {
  const script = assembleRScript(region, [
    fragment(['read_multibigwig']),
    { ...fragment(['read_bigwig']), plotVariable: 'p_track2' },
  ])
  expect(script.match(/^read_bigwig <- function/gm)).toHaveLength(1)
  expect(script.indexOf('read_bigwig <- function')).toBeLessThan(
    script.indexOf('# Data sources'),
  )
})
