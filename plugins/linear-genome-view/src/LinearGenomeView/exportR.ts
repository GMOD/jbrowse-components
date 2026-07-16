import { getConf } from '@jbrowse/core/configuration'
import { getSession, saveAs } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import { HELPERS } from './rHelpers.generated.ts'
import { rName, rStr, safeVarName } from './rexportShared.ts'

import type { LinearGenomeViewModel } from './model.ts'
import type { ExportRCodeOptions, RTrackFragment } from './types.ts'

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
      { sessionId: getRpcSessionId(model) },
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

/** Collect one R fragment per track whose display knows how to export. */
async function collectFragments(
  model: LinearGenomeViewModel,
  opts: ExportRCodeOptions,
) {
  const fragments: RTrackFragment[] = []
  for (const track of model.tracks) {
    const display = track.displays[0]
    if (hasRExport(display)) {
      const result = await display.exportRCode(opts)
      // a display may contribute several stacked panels (e.g. alignments emit a
      // coverage panel and a pileup panel); all panels of one track share the
      // track file's refName aliases
      const panels = Array.isArray(result) ? result : result ? [result] : []
      if (panels.length > 0) {
        const refNameMap = await resolveRefNameMap(model, track)
        for (const panel of panels) {
          fragments.push(refNameMap ? { ...panel, refNameMap } : panel)
        }
      }
    }
  }
  return fragments
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

export function assembleRScript(
  regionOrRegions: ViewRegion | ViewRegion[],
  fragments: RTrackFragment[],
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

  // each panel builds a ggplot referencing `regions`; a refname-aliased track
  // resolves the regions' chrom column to its file's names first. A cumulative-
  // axis panel (the default) gets the shared genomic x-scale + inter-region
  // dividers + coord range appended; a self-axis panel (the matrix) does not.
  const decorate = (f: RTrackFragment) =>
    f.cumulativeAxis === false
      ? ''
      : ` +
  region_scale(regions) + region_dividers(regions) +
  coord_cartesian(xlim = region_xlim(regions))`
  const panelBlocks = fragments
    .map(f =>
      hasRefNames(f)
        ? `  ${f.plotVariable} <- local({
    regions$chrom <- vapply(regions$chrom, function(cc) resolve_chrom(cc, ${refNameVar(f)}), character(1))
    ${f.plotExpr.replaceAll('\n', '\n    ')}
  })${decorate(f).replaceAll('\n', '\n  ')}`
        : `  ${f.plotVariable} <- ${`${f.plotExpr}${decorate(f)}`.replaceAll('\n', '\n  ')}`,
    )
    .join('\n\n')

  const heights = fragments.map(f => f.heightWeight ?? 1).join(', ')
  const trackList = fragments.map(f => f.plotVariable).join(', ')
  const totalHeight = Math.max(
    3,
    fragments.reduce((a, f) => a + (f.heightWeight ?? 1), 0) * 2,
  )
  const regionsDf = `data.frame(
  chrom = c(${regions.map(r => JSON.stringify(r.refName)).join(', ')}),
  start = c(${regions.map(r => r.start).join(', ')}),
  end = c(${regions.map(r => r.end).join(', ')}),
  stringsAsFactors = FALSE)`

  return `# ============================================================
# JBrowse 2 - reproducible R figure (pure ggplot2 + rtracklayer)
# Generated: ${new Date().toISOString()}
#
# plot_regions() redraws every track across one or more regions, concatenated on
# a single cumulative-bp x-axis (JBrowse's multi-region view). plot_region() is
# the single-region shorthand, so you can loop it over a BED file (see the batch
# example at the bottom). Everything below is plain ggplot2 - edit the geoms,
# scales and theme however you like.
# ============================================================

${packages.map(p => `library(${p})`).join('\n')}

${helpers}

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
  wrap_plots(panels, ncol = 1, heights = heights) +
    plot_annotation(title = region_title(regions))
}

# Single-region shorthand.
plot_region <- function(chrom, start, end)
  plot_regions(data.frame(chrom = chrom, start = start, end = end, stringsAsFactors = FALSE))

# The regions currently shown in JBrowse:
p <- plot_regions(${regionsDf})
print(p)

ggsave("jbrowse_region.png", p, width = 12, height = ${totalHeight}, dpi = 150)
ggsave("jbrowse_region.pdf", p, width = 12, height = ${totalHeight})

# ---- Batch: plot many regions from a BED file ----
# loci <- read.table("regions.bed", col.names = c("chrom", "start", "end"))
# for (i in seq_len(nrow(loci))) {
#   p <- plot_region(loci$chrom[i], loci$start[i], loci$end[i])
#   ggsave(sprintf("region_%03d.png", i), p, width = 12, height = ${totalHeight}, dpi = 150)
# }
# A single multi-region figure: pass all the loci at once.
# ggsave("multiregion.png", plot_regions(loci), width = 12, height = ${totalHeight}, dpi = 150)
`
}

/** Build the R script for the current view and download it. */
export async function exportR(
  model: LinearGenomeViewModel,
  opts: ExportRCodeOptions = {},
) {
  const regions = getViewRegions(model)
  const fragments = await collectFragments(model, opts)
  const script =
    regions.length > 0 && fragments.length > 0
      ? assembleRScript(regions, fragments)
      : '# No exportable tracks are shown. Add a supported track (e.g. a BigWig quantitative track) and try again.'

  saveAs(
    new Blob([script], { type: 'text/plain;charset=utf-8' }),
    opts.filename || 'jbrowse_view.R',
  )
}
