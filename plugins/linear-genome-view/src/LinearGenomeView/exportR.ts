import { getConf } from '@jbrowse/core/configuration'

import type { LinearGenomeViewModel } from './model.ts'
import type { ExportRCodeOptions, RCodeFragment } from './types.ts'

function formatRegion(region: {
  refName: string
  start: number
  end: number
}) {
  return `${region.refName}:${region.start + 1}-${region.end}`
}

function getVisibleRegions(model: LinearGenomeViewModel) {
  const blocks = model.coarseDynamicBlocks
  if (blocks.length === 0) {
    return model.displayedRegions
  }
  const regionMap = new Map<
    string,
    { refName: string; start: number; end: number }
  >()
  for (const block of blocks) {
    const existing = regionMap.get(block.refName)
    if (existing) {
      existing.start = Math.min(existing.start, Math.floor(block.start))
      existing.end = Math.max(existing.end, Math.ceil(block.end))
    } else {
      regionMap.set(block.refName, {
        refName: block.refName,
        start: Math.floor(block.start),
        end: Math.ceil(block.end),
      })
    }
  }
  return [...regionMap.values()]
}

/**
 * Generate session setup code from track configurations
 */
function generateSessionCode(
  model: LinearGenomeViewModel,
  opts: ExportRCodeOptions,
): string {
  const assemblyName = model.assemblyNames[0]
  const trackLines: string[] = []

  for (const track of model.tracks) {
    const trackId = track.configuration.trackId as string
    const adapterConf = getConf(track, 'adapter')
    const adapterType = adapterConf?.type as string | undefined

    const key = `"${trackId}"`

    if (adapterType === 'BigWigAdapter') {
      const uri = adapterConf.bigWigLocation?.uri
      if (uri) {
        trackLines.push(`    ${key} = jb_track_bigwig("${uri}")`)
      }
    } else if (
      adapterType === 'Gff3TabixAdapter' ||
      adapterType === 'Gff3Adapter'
    ) {
      const uri =
        adapterConf.gffGzLocation?.uri || adapterConf.gffLocation?.uri
      if (uri) {
        trackLines.push(`    ${key} = jb_track_gff3("${uri}")`)
      }
    } else if (
      adapterType === 'VcfTabixAdapter' ||
      adapterType === 'VcfAdapter'
    ) {
      const uri =
        adapterConf.vcfGzLocation?.uri || adapterConf.vcfLocation?.uri
      if (uri) {
        trackLines.push(`    ${key} = jb_track_vcf("${uri}")`)
      }
    } else if (adapterType === 'BamAdapter') {
      const uri = adapterConf.bamLocation?.uri
      if (uri) {
        trackLines.push(`    ${key} = jb_track_bam("${uri}")`)
      }
    } else if (adapterType === 'CramAdapter') {
      const uri = adapterConf.cramLocation?.uri
      if (uri) {
        trackLines.push(`    ${key} = jb_track_cram("${uri}")`)
      }
    } else if (
      adapterType === 'BedTabixAdapter' ||
      adapterType === 'BedAdapter'
    ) {
      const uri =
        adapterConf.bedGzLocation?.uri || adapterConf.bedLocation?.uri
      if (uri) {
        trackLines.push(`    ${key} = jb_track_bed("${uri}")`)
      }
    } else if (adapterType === 'MultiWiggleAdapter') {
      const subadapters = (adapterConf.subadapters || []) as {
        bigWigLocation?: { uri?: string }
        name?: string
      }[]
      const uris = subadapters
        .map(s => s.bigWigLocation?.uri)
        .filter(Boolean)
        .map(u => `"${u}"`)
      if (uris.length > 0) {
        trackLines.push(
          `    ${key} = jb_track_multi_bigwig(c(${uris.join(', ')}))`,
        )
      }
    } else if (adapterType === 'TwoBitAdapter') {
      const uri = adapterConf.twoBitLocation?.uri
      if (uri) {
        const display = track.displays[0] as Record<string, unknown>
        const windowSize = display?.windowSizeSetting ?? 100
        const windowDelta = display?.windowDeltaSetting ?? windowSize
        trackLines.push(
          `    ${key} = jb_track_gc_content("${uri}", window_size = ${windowSize}, window_delta = ${windowDelta})`,
        )
      }
    }
  }

  if (trackLines.length === 0) {
    return `
# No supported tracks found for auto-configuration
# Create session manually:
session <- jb_session(assembly = "${assemblyName}")`
  }

  return `
# Create session
session <- jb_session(
  assembly = "${assemblyName}",
  tracks = list(
${trackLines.join(',\n')}
  )
)`
}

/**
 * Collect R code fragments from all visible tracks
 */
async function collectRCodeFragments(
  model: LinearGenomeViewModel,
  opts: ExportRCodeOptions,
) {
  const fragments: RCodeFragment[] = []
  const regions = getVisibleRegions(model)

  if (regions.length === 0) {
    return fragments
  }

  for (const track of model.tracks) {
    const display = track.displays[0]
    console.log('exportRCode check', {
      trackId: track.configuration.trackId,
      displayType: display?.type,
      hasExportRCode: typeof display?.exportRCode,
    })
    if (display && typeof display.exportRCode === 'function') {
      try {
        const fragment = await display.exportRCode({
          ...opts,
          regions,
        })
        if (fragment) {
          fragments.push(fragment)
        }
      } catch (e) {
        console.error(`Failed to export R code for track ${track.id}:`, e)
      }
    }
  }

  return fragments
}

/**
 * Assemble a complete R script from code fragments
 */
function assembleRScript(
  model: LinearGenomeViewModel,
  fragments: RCodeFragment[],
  opts: ExportRCodeOptions,
): string {
  const regions = getVisibleRegions(model)
  if (regions.length === 0) {
    return '# Error: No region displayed'
  }

  const regionStrs = regions.map(r => formatRegion(r))
  const timestamp = new Date().toISOString()

  const allPackages = [...new Set(fragments.flatMap(f => f.packages))]
  const packages = [
    ...new Set(['ggjbrowse', 'ggplot2', 'patchwork', ...allPackages]),
  ]

  const sections: string[] = []

  sections.push(`# ============================================================
# JBrowse 2 - Reproducible R Script
# Generated: ${timestamp}
# Region: ${regionStrs.join(', ')}
# ============================================================`)

  sections.push(`
if (!requireNamespace("ggjbrowse", quietly = TRUE)) {
  if (!requireNamespace("devtools", quietly = TRUE)) {
    install.packages("devtools")
  }
  devtools::install_github("cmdcolin/ggjbrowse")
}
if (!requireNamespace("patchwork", quietly = TRUE)) {
  install.packages("patchwork")
}

${packages.map(p => `library(${p})`).join('\n')}`)

  if (regions.length === 1) {
    sections.push(`
region <- jb_region("${regionStrs[0]}")`)
  } else {
    sections.push(`
regions <- list(
${regionStrs.map(r => `  jb_region("${r}")`).join(',\n')}
)
region <- regions[[1]]`)
  }

  sections.push(generateSessionCode(model, opts))

  // Setup code from fragments
  const setupCodes = fragments
    .filter(f => f.setupCode)
    .map(f => f.setupCode)
  if (setupCodes.length > 0) {
    sections.push(`
# Additional setup
${setupCodes.join('\n\n')}`)
  }

  // Data loading section
  sections.push(`
# ============================================================
# Load Data
# ============================================================`)

  for (const fragment of fragments) {
    sections.push(`
# --- ${fragment.trackName} ---
${fragment.dataCode}`)
  }

  // Visualization section
  sections.push(`
# ============================================================
# Create Visualizations
# ============================================================`)

  for (const fragment of fragments) {
    sections.push(`
${fragment.plotCode}`)
  }

  // Combine tracks
  if (fragments.length > 0) {
    const plotVars = fragments.map(f => f.plotVariable)
    const heights = fragments.map(() => '1').join(', ')

    sections.push(`
# ============================================================
# Combine Tracks
# ============================================================

combined_plot <- ${plotVars.join(' / ')} +
  plot_layout(heights = c(${heights})) +
  plot_annotation(
    title = "JBrowse View: ${regionStrs.join(', ')}",
    theme = theme(plot.title = element_text(hjust = 0.5))
  )

# Display the plot
print(combined_plot)

# Save to file
ggsave("jbrowse_export.pdf", combined_plot, width = 12, height = ${Math.max(4, fragments.length * 2)})
ggsave("jbrowse_export.png", combined_plot, width = 12, height = ${Math.max(4, fragments.length * 2)}, dpi = 300)`)
  }

  sections.push(`
# ============================================================
# Alternative: Launch Interactive JBrowse View
# ============================================================

# Uncomment to open interactive JBrowse session in browser:
# jb_view(session, region)`)

  return sections.join('\n')
}

/**
 * Export the current view as an R script
 */
export async function exportR(
  model: LinearGenomeViewModel,
  opts: ExportRCodeOptions = {},
) {
  const fragments = await collectRCodeFragments(model, opts)
  const script = assembleRScript(model, fragments, opts)

  const filename = opts.filename || 'jbrowse_view.R'
  const blob = new Blob([script], { type: 'text/plain;charset=utf-8' })

  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const { saveAs } = await import('file-saver-es')
  saveAs(blob, filename)
}
