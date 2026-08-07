import type { ViewMode } from './modes.ts'
import type { themeNames } from './options.ts'
import type { Entry } from './parseArgv.ts'
import type { CigarMode } from '@jbrowse/plugin-linear-comparative-view'
import type { TrackLabelMode } from '@jbrowse/plugin-linear-genome-view'
import type { SyntenyColorBy } from '@jbrowse/synteny-core'

// Compile-time assertion that a type is empty. Used with `Exclude<...>` to prove
// a hand-written list covers every member of an upstream union: a member added
// there makes the Exclude non-never and fails the build.
export type AssertNever<T extends never> = T

// Compile-time assertion that a check resolved to `true`. Use this instead of
// AssertNever when the checked type is computed inside a generic alias, where an
// `extends never` parameter is checked against the type parameter's constraint
// rather than the instantiated type.
export type AssertTrue<T extends true> = T

// Proof that a hand-written value list covers every member of an upstream union.
// A value the union has but the list lacks resolves to that value instead of
// `true`, so the AssertTrue wrapping it fails the build and names the straggler.
// The Exclude can't go straight into an `extends never` type parameter: inside a
// generic alias it is checked against Upstream's own constraint (`string`),
// which is never empty, so the assertion failed for every list.
export type Covers<Upstream extends string, List extends readonly string[]> = [
  Exclude<Upstream, List[number]>,
] extends [never]
  ? true
  : Exclude<Upstream, List[number]>

export interface Opts {
  noRasterize?: boolean
  loc?: string
  width?: number
  session?: string
  assembly?: string
  config?: string
  // A genomes.jbrowse.org assembly to pull the whole config from: a UCSC db name
  // (hg19, mm10) or a GenArk accession (GCA_/GCF_...). Supplies the assembly
  // (sequence, cytobands, refNameAliases, geneticCodes) plus hosted trackIds
  // referenceable via --track. See resolveHub.ts.
  hub?: string
  fasta?: string
  aliases?: string
  cytobands?: string
  defaultSession?: boolean
  trackList?: Entry[]
  tracks?: string
  themeName?: (typeof themeNames)[number]
  // Font family applied to the whole SVG root so every <text> (ruler, track
  // labels, and SvgCanvas feature labels) renders in one consistent font
  // instead of relying on each SVG viewer's default. Defaults to serif.
  fontFamily?: string
  showGridlines?: boolean
  trackLabels?: TrackLabelMode
  refseq?: boolean
  // Emit the view's reproducible R script (the same one the browser's "Export R
  // script" menu item downloads) instead of an SVG. Selected by an `--out`
  // ending in `.R`, and linear-only — the comparative and circular views have no
  // R export. See renderLinear.
  emitR?: boolean
  mode?: ViewMode
  // The raw parsed CLI entries, in argv order. Comparative modes (dotplot /
  // synteny) build their stacked assemblies + per-level synteny tracks from this
  // — each --fasta/--chromSizes opens an assembly, each synteny file binds to the
  // gap it sits in. See comparativeArgs.ts.
  argv?: Entry[]
  // Comparative view-level settings exposed as CLI flags so the simple
  // dotplot/synteny subcommands can opt in without a full --spec JSON.
  autoDiagonalize?: boolean
  drawCurves?: boolean
  minAlignmentLength?: number
  colorBy?: SyntenyColorBy
  alpha?: number
  levelHeights?: number[]
  cigarMode?: CigarMode
  showColorLegend?: boolean
  // N-way comparative views: a session-spec JSON (inline or path to .json,
  // the same shape as the web's `&session=spec-`) that supplies the view's
  // sub-views and level-indexed tracks directly. Assemblies and synteny-track
  // configs it references by name come from --config. See urlparams.md.
  spec?: string
  // Hosted trackIds (from --hub/--config) to show in a linear view, each with
  // optional display modifiers — same [key, [trackId, ...opts]] shape as a
  // track-type flag. See renderRegion/applyDisplayOpts.
  showTracks?: Entry[]
}

export interface Assembly {
  name: string
  sequence: Record<string, unknown>
  refNameAliases?: Record<string, unknown>
  cytobands?: Record<string, unknown>
}

export interface Track {
  trackId: string
  displays?: unknown[]
  adapter?: Record<string, unknown>
  // SyntenyTracks carry their compared assemblies in [query, target] order;
  // used to place the track at the right level in a multi-assembly synteny view.
  assemblyNames?: string[]
  [key: string]: unknown
}

export interface TextSearchAdapter {
  textSearchAdapterId: string
  [key: string]: unknown
}

// A track built from a track-type CLI flag (--bam, --bigwig, …), paired with the
// display modifiers that followed the filename. readData assigns the trackId
// while building the config — it is the only place that can see two inputs
// competing for one basename — so the renderer opens what was actually built
// rather than re-deriving an id the config may not use.
export interface OpenTrack {
  trackId: string
  opts: string[]
}

export interface Config {
  assemblies: Assembly[]
  assembly: Assembly
  tracks: Track[]
  // Tracks to open in a linear view, in argv order. Undefined for a config that
  // readData didn't build from track flags.
  openTracks?: OpenTrack[]
  // Trix (or other) text-search adapters, e.g. from a --hub config, that let
  // --loc navigate by gene name. Passed through to createViewState.
  aggregateTextSearchAdapters?: TextSearchAdapter[]
  // Per-assembly location strings (aligned with `assemblies`) for comparative
  // views built from CLI args; undefined entries render that assembly
  // whole-genome.
  assemblyLocs?: (string | undefined)[]
  [key: string]: unknown
}
