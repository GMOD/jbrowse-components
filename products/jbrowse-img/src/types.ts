import type { ViewMode } from './modes.ts'
import type { themeModes, themeNames } from './options.ts'
import type {
  VariantAllele,
  VariantSortColumn,
} from '@jbrowse/alignments-core/variantSortColumn'
import type {
  Assembly,
  ComparativeRow,
  Entry,
  Track,
} from '@jbrowse/launch-args'
import type { TrackLabelMode } from '@jbrowse/plugin-linear-genome-view'

export type AssertNever<T extends never> = T

// Use instead of AssertNever when the checked type is computed inside a generic
// alias, where `extends never` is checked against the parameter's constraint.
export type AssertTrue<T extends true> = T

// Resolves to the missing values rather than `false`, so the failure names them
export type Covers<Upstream extends string, List extends readonly string[]> = [
  Exclude<Upstream, List[number]>,
] extends [never]
  ? true
  : Exclude<Upstream, List[number]>

export interface Opts {
  noRasterize?: boolean
  loc?: string
  sortAt?: VariantSortColumn
  /** `loc` is a junction's two ends on one contig, drawn side by side */
  joined?: boolean
  /** Keep this render's adapters cached for the next render of a batch */
  keepAdapters?: boolean
  sortAllele?: VariantAllele
  // 0-based half-open
  highlight?: { refName: string; start: number; end: number }
  width?: number
  session?: string
  assembly?: string
  config?: string
  // a UCSC db name or GenArk accession on genomes.jbrowse.org
  genome?: string
  fasta?: string
  defaultSession?: boolean
  trackList?: Entry[]
  trackConfigs?: string
  themeName?: (typeof themeNames)[number]
  themeMode?: (typeof themeModes)[number]
  fontFamily?: string
  showGridlines?: boolean
  trackLabels?: TrackLabelMode
  refseq?: boolean
  mode?: ViewMode
  // in argv order, since a synteny file binds to the gap between the assemblies
  // around it
  argv?: Entry[]
  view?: Record<string, unknown>
  spec?: string
  showTracks?: Entry[]
}

export type { Assembly, Track }

export interface TextSearchAdapter {
  type: string
  [key: string]: unknown
}

export interface OpenTrack {
  trackId: string
  opts: string[]
}

/** Unvalidated */
export interface ConfigFile {
  assemblies?: Assembly[]
  tracks?: Track[]
  aggregateTextSearchAdapters?: TextSearchAdapter[]
  defaultSession?: Record<string, unknown>
  [key: string]: unknown
}

export interface Config {
  assemblies: Assembly[]
  assembly: Assembly
  tracks: Track[]
  /** the tracks the file flags built, in argv order */
  openTracks: OpenTrack[]
  aggregateTextSearchAdapters?: TextSearchAdapter[]
  /** Undefined stacks `assemblies` whole */
  comparativeRows?: ComparativeRow[]
  defaultSession?: Record<string, unknown>
}
