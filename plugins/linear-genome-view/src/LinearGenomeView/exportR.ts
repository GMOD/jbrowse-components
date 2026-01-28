import { getConf } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { saveAs } from 'file-saver-es'

import type { LinearGenomeViewModel } from './model.ts'
import type { ExportRCodeOptions, RCodeFragment } from './types.ts'

/**
 * Generate a safe R variable name from a track ID
 */
function safeVarName(trackId: string): string {
  return trackId.replace(/[^a-zA-Z0-9]/g, '_').replace(/^(\d)/, '_$1')
}

/**
 * Format a region as an R-compatible string
 */
function formatRegion(region: {
  refName: string
  start: number
  end: number
}): string {
  return `${region.refName}:${region.start + 1}-${region.end}`
}

/**
 * Generate jbrowseR session setup code from track configurations
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

    const safeId = safeVarName(trackId)

    if (adapterType === 'BigWigAdapter') {
      const uri = adapterConf.bigWigLocation?.uri
      if (uri) {
        trackLines.push(`    ${safeId} = jb_track_bigwig("${uri}")`)
      }
    } else if (
      adapterType === 'Gff3TabixAdapter' ||
      adapterType === 'Gff3Adapter'
    ) {
      const uri = adapterConf.gffGzLocation?.uri
      if (uri) {
        trackLines.push(`    ${safeId} = jb_track_gff3("${uri}")`)
      }
    } else if (adapterType === 'VcfTabixAdapter' || adapterType === 'VcfAdapter') {
      const uri = adapterConf.vcfGzLocation?.uri
      if (uri) {
        trackLines.push(`    ${safeId} = jb_track_vcf("${uri}")`)
      }
    } else if (adapterType === 'BamAdapter') {
      const uri = adapterConf.bamLocation?.uri
      if (uri) {
        trackLines.push(`    ${safeId} = jb_track_bam("${uri}")`)
      }
    } else if (adapterType === 'BedTabixAdapter' || adapterType === 'BedAdapter') {
      const uri = adapterConf.bedGzLocation?.uri || adapterConf.bedLocation?.uri
      if (uri) {
        trackLines.push(`    ${safeId} = jb_track_bed("${uri}")`)
      }
    }
  }

  if (trackLines.length === 0) {
    return '# No supported tracks found for jbrowseR session'
  }

  return `
# Create jbrowseR session
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
): Promise<RCodeFragment[]> {
  const fragments: RCodeFragment[] = []
  const region = model.displayedRegions[0]

  if (!region) {
    return fragments
  }

  for (const track of model.tracks) {
    const display = track.displays[0]
    if (display && typeof display.exportRCode === 'function') {
      try {
        const fragment = await display.exportRCode({
          ...opts,
          region,
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
  const region = model.displayedRegions[0]
  if (!region) {
    return '# Error: No region displayed'
  }

  const regionStr = formatRegion(region)
  const timestamp = new Date().toISOString()

  // Collect all unique packages
  const allPackages = [...new Set(fragments.flatMap(f => f.packages))]

  // Base packages always needed
  const basePackages = ['ggplot2', 'patchwork']
  if (opts.useJbrowseR) {
    basePackages.unshift('jbrowseR', 'ggjbrowse')
  }

  const packages = [...new Set([...basePackages, ...allPackages])]

  // Build the script
  const sections: string[] = []

  // Header
  sections.push(`# ============================================================
# JBrowse 2 - Reproducible R Script
# Generated: ${timestamp}
# Region: ${regionStr}
# ============================================================`)

  // Package installation instructions
  sections.push(`
# Install packages if needed (uncomment to run)
# install.packages(c("ggplot2", "patchwork", "dplyr", "tibble"))
# BiocManager::install(c("rtracklayer", "VariantAnnotation", "Rsamtools"))
# devtools::install_github("GMOD/jbrowseR")
# devtools::install_github("GMOD/ggjbrowse")`)

  // Load packages
  sections.push(`
# Load required packages
${packages.map(p => `library(${p})`).join('\n')}`)

  // Define region
  sections.push(`
# Define region of interest
region <- jb_region("${regionStr}")`)

  // Session setup (if using jbrowseR)
  if (opts.useJbrowseR) {
    sections.push(generateSessionCode(model, opts))
  }

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
    title = "JBrowse View: ${regionStr}",
    theme = theme(plot.title = element_text(hjust = 0.5))
  )

# Display the plot
print(combined_plot)

# Save to file
ggsave("jbrowse_export.pdf", combined_plot, width = 12, height = ${Math.max(4, fragments.length * 2)})
ggsave("jbrowse_export.png", combined_plot, width = 12, height = ${Math.max(4, fragments.length * 2)}, dpi = 300)`)
  }

  // Alternative interactive view
  if (opts.useJbrowseR) {
    sections.push(`
# ============================================================
# Alternative: Launch Interactive JBrowse View
# ============================================================

# Uncomment to open interactive JBrowse session in browser:
# jb_view(session, region)`)
  }

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
  saveAs(blob, filename)
}
