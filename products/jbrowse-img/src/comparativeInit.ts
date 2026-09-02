import { pairSyntenyTrackIds, syntenyTrackLevels } from './syntenyTracks.ts'

import type { Config, Opts } from './types.ts'
import type { DotplotViewInit } from '@jbrowse/plugin-dotplot-view'
import type { LinearSyntenyViewInit } from '@jbrowse/plugin-linear-comparative-view'
import type { SyntenyViewSharedInit } from '@jbrowse/synteny-core'

// The `init` snapshot a comparative view is opened with, built from CLI flags
// (the --spec path supplies its own, see spec.ts). Split out of renderRegion.ts
// because that module imports the plugin renderToSvg chain, which pulls pure-ESM
// deps Jest's CJS transform can't load — this one is pure, so the snapshot shape
// is unit-testable. Same split, same reason, as applyTrackOpts.ts.
//
// Every builder returns the view's own exported init interface, so a knob a view
// stops reading fails the build here instead of silently doing nothing.

// Drop the keys whose value is undefined, so an unset flag leaves the view's own
// default in place. The point is the CALLER: it can pass a plain typed literal,
// which TypeScript excess-property checks against the view's init interface. The
// `...(x ? { k: v } : {})` spread chain this replaces is NOT excess-checked, which
// is what let a renamed knob go on silently doing nothing.
function definedOnly<T extends object>(obj: T): Partial<T> {
  const result: Partial<T> = {}
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] !== undefined) {
      result[key] = obj[key]
    }
  }
  return result
}

// The view-level knobs BOTH comparative modes accept, mirroring the plugins' own
// SyntenyViewSharedInit (which DotplotViewInit and LinearSyntenyViewInit each
// extend). `undefined` means "not set"; definedOnly strips those out.
//
// The booleans are deliberately narrowed to `true | undefined`: an absent CLI
// flag arrives as `false`, and both views apply an explicit `false` (their init
// guards read `!== undefined`), which would override the view's own default
// rather than leave it alone.
function sharedComparativeKnobs(opts: Opts): SyntenyViewSharedInit {
  return {
    autoDiagonalize: opts.autoDiagonalize ? true : undefined,
    showColorLegend: opts.showColorLegend ? true : undefined,
    colorBy: opts.colorBy,
    minAlignmentLength: opts.minAlignmentLength,
  }
}

// Dotplot takes the shared subset alone. Exported so the --spec path can merge
// the same flags over the spec's own settings, which is why this is a builder
// rather than a bare definedOnly call at each site.
export function dotplotViewKnobs(opts: Opts) {
  return definedOnly<Partial<DotplotViewInit>>(sharedComparativeKnobs(opts))
}

// Synteny adds the ribbon-shape knobs a dotplot has no equivalent for. The full
// set lives in --spec; these are the busy-comparison ones the simple subcommand
// exposes directly.
export function syntenyViewKnobs(opts: Opts) {
  return definedOnly<Partial<LinearSyntenyViewInit>>({
    ...sharedComparativeKnobs(opts),
    drawCurves: opts.drawCurves ? true : undefined,
    cigarMode: opts.cigarMode,
    alpha: opts.alpha,
    levelHeights: opts.levelHeights,
  })
}

// One sub-view per assembly in [query, target, …] order: the first
// --fasta/--chromSizes is the query (top in synteny, x-axis in dotplot).
// Comparative views render adjacent assembly pairs as stacked levels, so this
// supports an arbitrary number of assemblies (a-vs-b is the common case). Each
// assembly's optional location comes from data.assemblyLocs (a `loc:` modifier
// or the legacy --loc/--loc2); the rest show their whole genome.
export function comparativeViews(data: Config) {
  const { assemblies, assemblyLocs = [] } = data
  if (assemblies.length < 2) {
    throw new Error(
      'comparative mode requires at least two assemblies (repeat --fasta/--chromSizes, or use --fasta2)',
    )
  }
  return assemblies.map((asm, i) =>
    assemblyLocs[i]
      ? { assembly: asm.name, loc: assemblyLocs[i] }
      : { assembly: asm.name },
  )
}

// Dotplot is pairwise (x vs y), so it takes only the first two assemblies even
// if a config supplies more — and only the comparisons between those two.
// init.tracks is a flat list of comparison ids.
export function dotplotInit(data: Config, opts: Opts): DotplotViewInit {
  const [x, y] = data.assemblies
  return {
    views: comparativeViews(data).slice(0, 2),
    tracks: x && y ? pairSyntenyTrackIds(data, x.name, y.name) : [],
    ...dotplotViewKnobs(opts),
  }
}

// Synteny stacks every assembly, with each level's comparison tracks in the gap
// between the two assemblies they compare.
export function syntenyInit(data: Config, opts: Opts): LinearSyntenyViewInit {
  return {
    views: comparativeViews(data),
    tracks: syntenyTrackLevels(data),
    ...syntenyViewKnobs(opts),
  }
}
