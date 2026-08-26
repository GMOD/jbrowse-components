import { getConf } from '@jbrowse/core/configuration'
import { getContainingTrack } from '@jbrowse/core/util'
import { fileUrlToLocalPath } from '@jbrowse/core/util/io'

/**
 * What a display contributes to an exported R figure: the `RTrackFragment` it
 * returns from `exportRCode()`, and the codegen primitives for building one.
 *
 * Here rather than in the linear-genome-view plugin, where it started, because
 * the direction was backwards. `exportRCode()` and `renderSvg()` are two methods
 * of ONE display contract, and `renderSvg`'s options type
 * (`ExportSvgDisplayOptions`) is already in this package — so six display
 * plugins were reaching into a VIEW plugin for the other half. The rebase onto
 * main is what made that concrete: every one of those models had to be handed
 * an `import type { RTrackFragment } from '@jbrowse/plugin-linear-genome-view'`
 * beside an `ExportSvgDisplayOptions` it already took from here.
 *
 * The seam that leaves: a DISPLAY says what its panel is (this module); a VIEW
 * assembles the fragments into a runnable script (`exportR.ts` in the LGV
 * plugin, which owns the region loop, the shared axis and the helper library).
 *
 * Keeping the primitives in one copy is also what keeps the quoting and
 * escaping rules from drifting between track types.
 */

/** Quote an arbitrary string as an R string literal (escaping \\ and "). */
export function rStr(s: string) {
  return `"${s.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}

/**
 * A safe R variable/identifier derived from a trackId.
 *
 * The leading character is the whole subtlety: R accepts letters and `.` there
 * but NOT a digit and NOT an underscore, so prefixing a digit with `_` (the
 * obvious guard, and what this did) produces `_1KGP_3202…`, which R rejects at
 * PARSE time — `unexpected numeric constant`. The whole script then fails to
 * run, from any track whose id starts with a digit: `1000g_…`, `1KGP_…`, a
 * chromosome-named track. Prefix with a letter instead.
 */
export function safeVarName(str: string) {
  return str.replaceAll(/[^a-zA-Z0-9]/g, '_').replace(/^(?=[\d_])/, 'x')
}

/**
 * The frame a panel was built from, for a fragment that binds its data
 * (`RTrackFragment.dataExpr`): `p_foo` -> `d_foo`. One rule in one place,
 * because two sides have to agree on the name — assembleRScript emits the
 * assignment, and the fragment's own `plotExpr` reads it back.
 */
export function rDataVariable(plotVariable: string) {
  return plotVariable.replace(/^p_/, 'd_')
}

/**
 * The emitted figure's own geometry, single-sourced because two different
 * decisions read it and neither fails loudly when it drifts: assembleRScript
 * writes the trailing `ggsave()` from it, and a panel that has to estimate TEXT
 * width — which a ggplot cannot do, living in data space — sizes its labels
 * against it (`label_room`, and the multi-wiggle's per-source axis). Change the
 * ggsave width alone and label decimation silently mis-tunes, with nothing
 * anywhere saying so.
 */
export const FIGURE_WIDTH_INCHES = 12
export const FIGURE_DPI = 150
/** Inches of figure per unit of `RTrackFragment.heightWeight`. */
export const FIGURE_INCHES_PER_WEIGHT = 2

/** An R named-vector name in backticks — any string is valid when backtick
 * quoted, so strip stray backticks that would break the quoting. */
export function rName(s: string) {
  return `\`${s.replaceAll('`', '')}\``
}

/**
 * The path R should read, first non-empty among the given candidates (a config
 * fallback chain, since an adapter may spell its source in more than one slot).
 *
 * A candidate may be a bare string or a whole `FileLocation`, and taking the
 * location is what callers should do: a location is a `uri` **or** a
 * `localPath`, and reading only `.uri` emitted `path <- ""` for every
 * local-file track — jbrowse-desktop's normal case, and every file jb2export is
 * pointed at from disk. That failed in R, far from here, as an unreadable empty
 * path rather than as a missing export.
 */
export interface RFileLocation {
  uri?: string
  localPath?: string
  // Stamped next to every `uri` when a config is loaded from a url
  // (addRelativeUris), because a JBrowse config addresses its data RELATIVE TO
  // ITSELF — test_data/volvox/config.json says `volvox.test.vcf.gz`. The app
  // resolves that at fetch time; an R script has no such base, so an
  // unresolved uri lands in the script as a bare filename that R cannot open.
  baseUri?: string
}

export function firstUri(
  ...candidates: (string | RFileLocation | undefined)[]
) {
  for (const c of candidates) {
    if (typeof c === 'string') {
      if (c) {
        return c
      }
      continue
    }
    if (c?.uri) {
      const uri = c.baseUri ? new URL(c.uri, c.baseUri).href : c.uri
      // A `file:` URL is a path to R, not something to fetch — the same
      // conversion `openLocation` makes. Desktop reaches this on every track: a
      // config.json opened from disk carries its own directory as `baseUri`, so
      // a relative `reads.bam` resolves here as `file:///dir/reads.bam`, which
      // Rsamtools cannot open.
      return fileUrlToLocalPath(uri) ?? uri
    }
    if (c?.localPath) {
      return c.localPath
    }
  }
  return ''
}

export interface RTrackMeta<A> {
  trackId: string
  trackName: string
  /** safeVarName(trackId) — the R variable base for this track's fragment */
  pathVar: string
  adapter: A
}

/** Pull the trackId, display name, adapter config and R variable base off the
 * display's containing track — the identical preamble every exportRCode runs. */
export function getTrackRMeta<A>(self: unknown): RTrackMeta<A> {
  const track = getContainingTrack(self)
  const trackId: string = track.configuration.trackId
  const adapter: A = getConf(track, 'adapter')
  return {
    trackId,
    trackName: getConf(track, 'name') || trackId,
    pathVar: safeVarName(trackId),
    adapter,
  }
}

/**
 * One track's contribution to the exported R script. The generated code is pure
 * `rtracklayer` + base `ggplot2` (no bespoke package) so it can be edited with
 * ordinary ggplot2 knowledge. A display returns the R expression that builds its
 * ggplot panel (referencing `chrom`, `start`, `end` from the enclosing
 * `plot_region()` function), so the whole figure regenerates for any region.
 */
export interface RTrackFragment {
  trackId: string
  trackName: string
  // R packages the panel needs library()'d, e.g. ['rtracklayer', 'ggplot2']
  packages: string[]
  // names of inline helper definitions this panel uses (keys of the codegen
  // HELPERS table, e.g. 'read_bigwig', 'bp_axis'); emitted once, deduped
  helpers: string[]
  // top-level R statement(s) run once before plot_region(), e.g. the track's
  // file-path variable assignment
  setup: string
  // name of the R variable the panel is assigned to, e.g. 'p_coverage'
  plotVariable: string
  // multi-line R expression assigned to plotVariable inside plot_region(); may
  // reference `chrom`, `start`, `end` and the track's setup variable
  plotExpr: string
  // relative patchwork height for this panel (default 1)
  heightWeight?: number
  // Bind this panel's data to `d_<plotVariable minus its p_ prefix>` before the
  // plot, instead of embedding the read inline in `plotExpr`. Two things need
  // it, and both are why it exists: a height that is a FUNCTION of what was read
  // (heightWeightExpr below, so a feature track that packs 61 rows gets a panel
  // 61 rows tall rather than the codegen's guess), and a reader who wants to
  // inspect the frame a panel drew. `plotExpr` then references the variable.
  dataExpr?: string
  // R expression for this panel's patchwork height, evaluated after `dataExpr`
  // and free to read it. Overrides heightWeight when present; the resulting
  // figure height is computed in R too (see assembleRScript's jb_height_in).
  heightWeightExpr?: string
  // whether this panel lives on the shared cumulative-bp x-axis (the default):
  // plot_regions() adds region_scale + inter-region dividers + the coord range to
  // it. Set false for a panel that manages its own x-axis and is not genomic-bp
  // indexed (e.g. the site-indexed multi-sample variant matrix), so the cumulative
  // decoration is not applied.
  cumulativeAxis?: boolean
  // Display settings this panel could NOT reproduce, phrased for a reader —
  // `Group by tag HP`, say. Named in the script's header rather than dropped in
  // silence, the same doctrine as translateFeatureFilters' NOT TRANSLATED note
  // and the skipped-track list: a figure that quietly differs from the browser
  // view it claims to twin is the failure mode worth spending a comment on.
  unreproduced?: string[]
  // JBrowse refname aliases for this track's file: canonical refName -> the
  // name the file actually uses (chr1 vs 1 vs NC_000001.11), only entries that
  // differ. Attached by the view (not the per-display builder) from the
  // assembly's per-adapter refName map, so the emitted script translates the
  // canonical `chrom` before reading each file. Empty/undefined = no aliasing.
  refNameMap?: Record<string, string>
}
