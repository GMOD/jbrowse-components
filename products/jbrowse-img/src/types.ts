import type { ViewMode } from './modes.ts'
import type { Entry } from './parseArgv.ts'
import type { TrackLabelMode } from '@jbrowse/plugin-linear-genome-view'

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
  themeName?: string
  showGridlines?: boolean
  trackLabels?: TrackLabelMode
  refseq?: boolean
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
  colorBy?: string
  alpha?: number
  levelHeights?: number[]
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

export interface Config {
  assemblies: Assembly[]
  assembly: Assembly
  tracks: Track[]
  // Per-assembly location strings (aligned with `assemblies`) for comparative
  // views built from CLI args; undefined entries render that assembly
  // whole-genome.
  assemblyLocs?: (string | undefined)[]
  [key: string]: unknown
}
