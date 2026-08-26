import { getConf } from '@jbrowse/core/configuration'
import { awaitSvgReady, awaitViewInitialized } from '@jbrowse/core/svg/svgReady'
import { getSession, saveAs } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import {
  FIGURE_DPI,
  FIGURE_INCHES_PER_WEIGHT,
  FIGURE_WIDTH_INCHES,
  rDataVariable,
  rName,
  rStr,
  safeVarName,
} from '@jbrowse/display-kit/RExportFragment'

import { HELPERS } from './rHelpers.generated.ts'
import {
  BROWSER_LOCAL_FILE_REASON,
  readsBrowserLocalFile,
} from './rexportLocalFiles.ts'

import type { LinearGenomeViewModel } from './model.ts'
import type { ExportRCodeOptions, RTrackFragment } from './types.ts'
import type { SvgExportable } from '@jbrowse/core/svg/svgReady'

interface ViewRegion {
  refName: string
  start: number
  end: number
}

interface RExportDisplay {
  exportRCode: (
    opts: ExportRCodeOptions,
  ) => Promise<RTrackFragment | RTrackFragment[] | undefined>
}

function hasRExport(display: unknown): display is RExportDisplay {
  return (
    typeof display === 'object' &&
    display !== null &&
    'exportRCode' in display &&
    typeof display.exportRCode === 'function'
  )
}

/** A shown track that contributed no panel, for the note in the script. */
export interface SkippedTrack {
  name: string
  displayType: string
  /**
   * Why, where something more specific than "this display contributed no R
   * code" can be said — and, for the local-file case, what to do about it.
   */
  reason?: string
}

/** The track's display name, falling back to its id — as getTrackRMeta does. */
function trackLabel(track: LinearGenomeViewModel['tracks'][number]) {
  const trackId: string = track.configuration.trackId
  const name: string = getConf(track, 'name')
  return name || trackId
}

// track.displays[] is typed `any` at this boundary (pluggableMstType), so read
// the discriminator through a guard rather than off it.
function displayType(display: unknown) {
  const { type } = (display ?? {}) as { type?: unknown }
  return typeof type === 'string' ? type : 'this display'
}

/**
 * The regions currently visible in the view, each collapsed to a single span.
 * A multi-region (discontiguous) view yields several: coarse blocks are grouped
 * by their displayed-region index (so consecutive tiles of one region merge, but
 * two regions on the same refName stay separate). Falls back to displayedRegions
 * before the coarse blocks have been computed.
 */
function getViewRegions(model: LinearGenomeViewModel): ViewRegion[] {
  const blocks = model.coarseDynamicBlocks
  if (blocks.length > 0) {
    const byRegion = new Map<number, ViewRegion>()
    for (const block of blocks) {
      const key = block.displayedRegionIndex ?? -1
      const existing = byRegion.get(key)
      if (existing?.refName === block.refName) {
        existing.start = Math.min(existing.start, Math.floor(block.start))
        existing.end = Math.max(existing.end, Math.ceil(block.end))
      } else {
        byRegion.set(key, {
          refName: block.refName,
          start: Math.floor(block.start),
          end: Math.ceil(block.end),
        })
      }
    }
    return [...byRegion.values()]
  }
  return model.displayedRegions.map(r => ({
    refName: r.refName,
    start: Math.floor(r.start),
    end: Math.ceil(r.end),
  }))
}

/**
 * The track file's refname aliases as canonical -> file name, keeping only the
 * entries that differ (the ones needing translation). Mirrors what JBrowse uses
 * to fetch: `getRefNameMapForAdapter` runs the same CoreGetRefNames resolution
 * against the assembly's aliases, so a track whose file names contigs
 * differently from the assembly (chr1 vs 1) still reads. Returns undefined when
 * nothing differs, so the common case emits no aliasing code. Resolution
 * failures are swallowed (the export still works, just without translation).
 */
async function resolveRefNameMap(
  model: LinearGenomeViewModel,
  track: LinearGenomeViewModel['tracks'][number],
) {
  try {
    const { assemblyManager } = getSession(model)
    const map = await assemblyManager.getRefNameMapForAdapter(
      getConf(track, 'adapter'),
      model.assemblyNames[0],
      // the TRACK, not the view: getRpcSessionId walks *up* the tree for a node
      // carrying rpcSessionId, and that node is BaseTrackModel. Handed the view
      // it reached the root and threw on every call, so the catch below turned
      // every alias map into `undefined` and the emitted script read a file by
      // its canonical refName — silently zero rows for any track whose file
      // spells the contig differently. `exportRRefnames.test.ts` did not catch
      // it: it hands assembleRScript a refNameMap directly, so it covers the
      // codegen and never this resolution.
      { sessionId: getRpcSessionId(track) },
    )
    const diff: Record<string, string> = {}
    for (const [canonical, name] of Object.entries(map)) {
      if (canonical !== name) {
        diff[canonical] = name
      }
    }
    return Object.keys(diff).length > 0 ? diff : undefined
  } catch (e) {
    console.error(e)
    return undefined
  }
}

/**
 * Collect one R fragment per track whose display knows how to export, plus the
 * shown tracks that contributed nothing — a display type with no `exportRCode`
 * at all, or one whose builder declined this particular track (the multi-wiggle
 * exporter reads BigWigs, so a MultiQuantitativeTrack over a bedMethyl file
 * yields no sources). Both used to leave the figure a track short with nothing
 * anywhere saying so, which is the same silence `translateFeatureFilters`
 * refuses for a filter it can't translate.
 */
async function collectFragments(
  model: LinearGenomeViewModel,
  opts: ExportRCodeOptions,
) {
  const fragments: RTrackFragment[] = []
  const skipped: SkippedTrack[] = []
  for (const track of model.tracks) {
    const display = track.displays[0]
    // Declined before the display is even asked, and centrally rather than in
    // each exportRCode: a local file chosen in jbrowse-web is a blob/handle
    // with no path, so EVERY exporter would resolve it to '' — including ones
    // added after this was written.
    const localFile = readsBrowserLocalFile(getConf(track, 'adapter'))
    const result =
      !localFile && hasRExport(display)
        ? await display.exportRCode(opts)
        : undefined
    // a display may contribute several stacked panels (e.g. alignments emit a
    // coverage panel and a pileup panel); all panels of one track share the
    // track file's refName aliases
    const panels = Array.isArray(result) ? result : result ? [result] : []
    if (panels.length > 0) {
      const refNameMap = await resolveRefNameMap(model, track)
      for (const panel of panels) {
        fragments.push(refNameMap ? { ...panel, refNameMap } : panel)
      }
    } else {
      skipped.push({
        name: trackLabel(track),
        displayType: displayType(display),
        reason: localFile ? BROWSER_LOCAL_FILE_REASON : undefined,
      })
    }
  }
  return { fragments, skipped }
}

// R infrastructure emitted into every script (not opt-in per fragment): the
// cumulative-bp region layout that lets one figure span several discontiguous
// regions, JBrowse's multi-region view.
const REGION_HELPERS = new Set([
  'region_layout',
  'read_regions',
  'region_scale',
  'region_dividers',
  'region_xlim',
  'region_ruler',
  'region_title',
])

/**
 * Helpers that call other helpers. A fragment declares only what its own plot
 * code calls; `resolveHelpers` pulls the rest in, so a caller of `read_bam`
 * doesn't have to know that `read_bam` classifies orientation internally. Adding
 * a call from one helper to another means adding the edge here — and only here.
 * `exportR.test.ts` scans the helper bodies and fails if an edge is missing.
 */
const HELPER_DEPS: Record<string, string[]> = {
  read_multibigwig: ['read_bigwig'],
  read_bam: ['pair_orientation'],
  bam_mismatches: ['open_reference'],
  mismatch_fade_alpha: ['snp_freq_threshold'],
  region_ruler: ['region_scale', 'region_dividers', 'region_xlim'],
}

/** The requested helpers plus everything they transitively call. */
export function resolveHelpers(requested: Iterable<string>) {
  const seen = new Set<string>()
  const visit = (name: string) => {
    if (!seen.has(name)) {
      seen.add(name)
      for (const dep of HELPER_DEPS[name] ?? []) {
        visit(dep)
      }
    }
  }
  for (const name of requested) {
    visit(name)
  }
  return seen
}

/**
 * Wrap a skipped track's reason into the script's comment column. The reason is
 * one sentence in one place (rexportLocalFiles) so the dialog and the script
 * can't drift; only this side has to fit it into a generated file.
 */
function wrapComment(text: string, indent = '#       ', width = 79) {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    if (line && `${indent}${line} ${word}`.length > width) {
      lines.push(indent + line)
      line = word
    } else {
      line = line ? `${line} ${word}` : word
    }
  }
  if (line) {
    lines.push(indent + line)
  }
  return lines.join('\n')
}

// ggsave refuses a dimension over this many inches unless you pass
// limitsize = FALSE, so an unclamped total is a script that dies at its very
// last line, after every read.
const MAX_GGSAVE_INCHES = 50

export function assembleRScript(
  regionOrRegions: ViewRegion | ViewRegion[],
  fragments: RTrackFragment[],
  skipped: SkippedTrack[] = [],
) {
  const regions = Array.isArray(regionOrRegions)
    ? regionOrRegions
    : [regionOrRegions]
  const packages = [
    ...new Set([
      'rtracklayer',
      'ggplot2',
      'patchwork',
      ...fragments.flatMap(f => f.packages),
    ]),
  ]
  // one deduped `<track>_refnames <- c(canonical = "file name", ...)` per track
  // that needs alias translation; the panel resolves the regions' chrom column
  const hasRefNames = (f: RTrackFragment) =>
    !!f.refNameMap && Object.keys(f.refNameMap).length > 0
  const refNameVar = (f: RTrackFragment) => `${safeVarName(f.trackId)}_refnames`
  const refNameVecs = new Map<string, string>()
  for (const f of fragments) {
    const map = f.refNameMap
    if (map && Object.keys(map).length > 0) {
      const entries = Object.entries(map)
        .map(([canonical, name]) => `${rName(canonical)} = ${rStr(name)}`)
        .join(', ')
      refNameVecs.set(refNameVar(f), `c(${entries})`)
    }
  }

  // emit helper defs in a stable order (HELPERS' own), deduped, closed over
  // helper-to-helper calls. The region infrastructure is always emitted;
  // resolve_chrom rides on any fragment carrying a refNameMap.
  const needed = resolveHelpers([
    ...REGION_HELPERS,
    ...(fragments.some(hasRefNames) ? ['resolve_chrom'] : []),
    ...fragments.flatMap(f => f.helpers),
  ])
  const helpers = Object.keys(HELPERS)
    .filter(name => needed.has(name))
    .map(name => HELPERS[name])
    .join('\n\n')
  const setups = [...new Set(fragments.map(f => f.setup))].join('\n')
  const refNameSetup =
    refNameVecs.size > 0
      ? `\n\n# JBrowse refname aliases: translate the view's canonical chromosome
# name to the one each track's file uses (see resolve_chrom).
${[...refNameVecs].map(([name, vec]) => `${name} <- ${vec}`).join('\n')}`
      : ''

  // each panel builds a ggplot referencing `regions`. A cumulative-axis panel
  // (the default) gets the shared genomic x-scale + inter-region dividers +
  // coord range appended; a self-axis panel (the matrix) does not.
  const decorate = (f: RTrackFragment) =>
    f.cumulativeAxis === false
      ? ''
      : ` +
  region_scale(regions) + region_dividers(regions) +
  coord_cartesian(xlim = region_xlim(regions))`
  // A refname-aliased track resolves the regions' chrom column to its file's
  // names before it reads; that wrapper goes around whichever statement does
  // the reading — the bound data when there is one, the whole ggplot otherwise.
  const dataVar = (f: RTrackFragment) => rDataVariable(f.plotVariable)
  const aliased = (f: RTrackFragment, expr: string) =>
    hasRefNames(f)
      ? `local({
    regions$chrom <- vapply(regions$chrom, function(cc) resolve_chrom(cc, ${refNameVar(f)}), character(1))
    ${expr.replaceAll('\n', '\n    ')}
  })`
      : expr

  const panelBlocks = fragments
    .map(f => {
      // the alias wrapper goes around whichever statement READS — the bound
      // data when there is one, and only then the plot
      const body = f.dataExpr ? f.plotExpr : aliased(f, f.plotExpr)
      const plot = `  ${f.plotVariable} <- ${`${body}${decorate(f)}`.replaceAll('\n', '\n  ')}`
      return f.dataExpr
        ? `  ${dataVar(f)} <- ${aliased(f, f.dataExpr).replaceAll('\n', '\n  ')}\n${plot}`
        : plot
    })
    .join('\n\n')

  // A panel that knows its own size says so in R, where it has actually read
  // the data: a feature track that packs 61 rows needs a panel 61 rows tall,
  // and no codegen-time constant can know that. The rest keep their static
  // weight — a coverage histogram is a coverage histogram.
  const heights = fragments
    .map(f => f.heightWeightExpr ?? f.heightWeight ?? 1)
    .join(', ')
  const trackList = fragments.map(f => f.plotVariable).join(', ')
  const regionsDf = `data.frame(
  chrom = c(${regions.map(r => JSON.stringify(r.refName)).join(', ')}),
  start = c(${regions.map(r => r.start).join(', ')}),
  end = c(${regions.map(r => r.end).join(', ')}),
  stringsAsFactors = FALSE)`

  // Named in the script itself, not just in the app: the figure is one track
  // short of the view it came from, and the person reading the .R later is the
  // one who needs to know which.
  const skippedNote = skipped.length
    ? `
#
# Tracks shown in JBrowse but NOT in this figure - their display contributed no
# R code, either because that display type has no R export or because its data
# source is one the exporter cannot read:
${skipped
  .map(
    s =>
      `#   - ${s.name} (${s.displayType})${s.reason ? `\n${wrapComment(s.reason)}` : ''}`,
  )
  .join('\n')}`
    : ''

  // The other half of the same honesty: a track IS here, but a setting it was
  // drawn with is not.
  const unreproduced = fragments.flatMap(f =>
    (f.unreproduced ?? []).map(note => `#   - ${f.trackName}: ${note}`),
  )
  const unreproducedNote = unreproduced.length
    ? `
#
# Display settings this figure does not reproduce, so it differs from the
# browser view it came from in these respects:
${[...new Set(unreproduced)].join('\n')}`
    : ''

  return `# ============================================================
# JBrowse 2 - reproducible R figure (pure ggplot2 + rtracklayer)
# Generated: ${new Date().toISOString()}${skippedNote}${unreproducedNote}
#
# plot_regions() redraws every track across one or more regions, concatenated on
# a single cumulative-bp x-axis (JBrowse's multi-region view). plot_region() is
# the single-region shorthand, so you can loop it over a BED file (see the batch
# example at the bottom). Everything below is plain ggplot2 - edit the geoms,
# scales and theme however you like.
# ============================================================

${packages.map(p => `library(${p})`).join('\n')}

${helpers}

# The figure's geometry, read by the ggsave() at the bottom AND by any panel
# that has to estimate how wide a piece of TEXT will be - a ggplot lives in data
# space, so the device's pixel width is the only thing that can answer that (see
# label_room). Widen fig_width and the labels a dense track can afford widen
# with it.
fig_width <- ${FIGURE_WIDTH_INCHES}
fig_dpi <- ${FIGURE_DPI}
fig_inches_per_weight <- ${FIGURE_INCHES_PER_WEIGHT}
# the plotting area, i.e. minus the y axis and its labels
fig_width_px <- round(fig_width * fig_dpi * 0.96)

# Data sources (local paths or URLs).
${setups}${refNameSetup}

# Draw every track across the given regions and stack them into one figure.
# 'regions' is a data.frame(chrom, start, end); start/end are 0-based half-open
# (as in a BED file). Regions are laid out left-to-right on a shared axis.
plot_regions <- function(regions) {
  regions <- region_layout(regions)

${panelBlocks}

  # stack the panels; a region-name ruler goes on top when more than one region
  # is shown (each panel already carries the shared axis + dividers it needs)
  panels <- list(${trackList})
  heights <- c(${heights})
  if (nrow(regions) > 1) {
    panels <- c(list(region_ruler(regions)), panels)
    heights <- c(0.4, heights)
  }
  out <- wrap_plots(panels, ncol = 1, heights = heights) +
    plot_annotation(title = region_title(regions))
  # This figure's own height in inches, carried on the plot because only THIS
  # call knows it: a panel is free to size itself from the data it just read
  # (see the heights above), so the total is not a constant the generator could
  # have written. ggsave refuses a dimension over ${MAX_GGSAVE_INCHES} inches, and 400 feet
  # of PNG is not what anyone wanted either, so it is clamped - the panels keep
  # their relative heights, so the figure is the same one at a size a device
  # will make.
  attr(out, "jb_height_in") <- min(${MAX_GGSAVE_INCHES}, max(3, sum(heights) * fig_inches_per_weight))
  out
}

# Single-region shorthand.
plot_region <- function(chrom, start, end)
  plot_regions(data.frame(chrom = chrom, start = start, end = end, stringsAsFactors = FALSE))

# The regions currently shown in JBrowse:
p <- plot_regions(${regionsDf})
print(p)

fig_height <- attr(p, "jb_height_in")
ggsave("jbrowse_region.png", p, width = fig_width, height = fig_height, dpi = fig_dpi)
ggsave("jbrowse_region.pdf", p, width = fig_width, height = fig_height)

# ---- Batch: plot many regions from a BED file ----
# loci <- read.table("regions.bed", col.names = c("chrom", "start", "end"))
# for (i in seq_len(nrow(loci))) {
#   p <- plot_region(loci$chrom[i], loci$start[i], loci$end[i])
#   ggsave(sprintf("region_%03d.png", i), p, width = fig_width, height = attr(p, "jb_height_in"), dpi = fig_dpi)
# }
# A single multi-region figure: pass all the loci at once.
# p <- plot_regions(loci)
# ggsave("multiregion.png", p, width = fig_width, height = attr(p, "jb_height_in"), dpi = fig_dpi)
`
}

/**
 * The R script for the current view, as a string.
 *
 * Split out of `exportR` so a headless caller gets the script without a DOM:
 * `jb2export --out fig.R` builds the same LGV model the browser does (main-thread
 * RPC, no worker) and needs the text, not a download. That also makes every
 * gallery figure reproducible from one command — `website/scripts/specs/rexport.ts`
 * renders them by running this output through `Rscript`, so a codegen change
 * moves the committed figure instead of silently disagreeing with it.
 */
export async function buildRScript(
  model: LinearGenomeViewModel,
  opts: ExportRCodeOptions = {},
) {
  // Same gate the SVG export waits on, for the same reason (see
  // core/svg/svgReady): a fragment builder reads loaded display state, so
  // reading it mid-fetch is the off-screen-renderer hazard that module exists
  // to name. Interactively this is already satisfied — you export what you are
  // looking at — but headlessly (`jb2export --out fig.R`) nothing else forces
  // it: the Hi-C panel needs `effectiveResolution`, which arrives with the
  // .hic header, so an unawaited export emitted "no exportable tracks are
  // shown" for a track that was merely still loading.
  await awaitViewInitialized(model)
  await Promise.all(
    model.tracks.flatMap(track =>
      track.displays.map((display: { svgReady?: boolean }) =>
        'svgReady' in display ? awaitSvgReady(display as SvgExportable) : null,
      ),
    ),
  )
  const regions = getViewRegions(model)
  const { fragments, skipped } = await collectFragments(model, opts)
  return regions.length > 0 && fragments.length > 0
    ? assembleRScript(regions, fragments, skipped)
    : '# No exportable tracks are shown. Add a supported track (e.g. a BigWig quantitative track) and try again.'
}

/** Build the R script for the current view and download it. */
export async function exportR(
  model: LinearGenomeViewModel,
  opts: ExportRCodeOptions = {},
) {
  saveAs(
    new Blob([await buildRScript(model, opts)], {
      type: 'text/plain;charset=utf-8',
    }),
    opts.filename || 'jbrowse_view.R',
  )
}
