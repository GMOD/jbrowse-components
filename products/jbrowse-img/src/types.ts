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
  // Comparative modes (dotplot/synteny) render two assemblies. The second
  // assembly and its location are supplied alongside the primary --fasta/--loc.
  mode?: ViewMode
  fasta2?: string
  aliases2?: string
  assembly2?: string
  loc2?: string
  // Comparative view-level settings exposed as CLI flags so the simple
  // dotplot/synteny subcommands can opt in without a full --spec JSON.
  autoDiagonalize?: boolean
  drawCurves?: boolean
  // N-way comparative views: a session-spec JSON (inline or path to .json,
  // the same shape as the web's `&session=spec-`) that supplies the view's
  // sub-views and level-indexed tracks directly. Assemblies and synteny-track
  // configs it references by name come from --config. See urlparams.md.
  spec?: string
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
  // SyntenyTracks carry their compared assemblies in [query, target] order;
  // used to place the track at the right level in a multi-assembly synteny view.
  assemblyNames?: string[]
  [key: string]: unknown
}

export interface Config {
  assemblies: Assembly[]
  assembly: Assembly
  tracks: Track[]
  [key: string]: unknown
}
