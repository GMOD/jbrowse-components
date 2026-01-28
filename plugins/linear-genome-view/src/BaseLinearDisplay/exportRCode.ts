import { getConf } from '@jbrowse/core/configuration'
import { getContainingTrack, getContainingView } from '@jbrowse/core/util'

import type { BaseLinearDisplayModel } from './model.ts'
import type { LinearGenomeViewModel } from '../LinearGenomeView/model.ts'

interface ExportRCodeOptions {
  useJbrowseR?: boolean
  embedData?: boolean
  region?: {
    refName: string
    start: number
    end: number
  }
}

interface RCodeFragment {
  trackId: string
  trackName: string
  displayType: string
  packages: string[]
  dataCode: string
  plotCode: string
  dataVariable: string
  plotVariable: string
  setupCode?: string
}

/**
 * Generate a safe R variable name
 */
function safeVarName(str: string): string {
  return str.replace(/[^a-zA-Z0-9]/g, '_').replace(/^(\d)/, '_$1')
}

/**
 * Export R code for BaseLinearDisplay (gene/feature tracks)
 */
export function exportRCode(
  self: BaseLinearDisplayModel,
  opts: ExportRCodeOptions,
): RCodeFragment {
  const track = getContainingTrack(self)
  const view = getContainingView(self) as LinearGenomeViewModel
  const trackId = track.configuration.trackId as string
  const trackName = (getConf(track, 'name') as string) || trackId
  const adapterConf = getConf(track, 'adapter')
  const adapterType = adapterConf?.type as string

  const region = opts.region || view.displayedRegions[0]
  const safeId = safeVarName(trackId)
  const dataVar = `features_${safeId}`
  const plotVar = `p_${safeId}`

  let packages: string[]
  let dataCode: string
  let plotCode: string

  if (opts.useJbrowseR) {
    packages = ['jbrowseR', 'ggjbrowse', 'ggplot2', 'dplyr']
    dataCode = `# Load feature data using jbrowseR
${dataVar} <- jb_features(session, "${trackId}", region)`
  } else {
    packages = ['rtracklayer', 'ggjbrowse', 'ggplot2', 'tibble', 'dplyr', 'GenomicRanges']

    if (adapterType === 'Gff3TabixAdapter' || adapterType === 'Gff3Adapter') {
      const uri =
        adapterConf.gffGzLocation?.uri ||
        adapterConf.gffLocation?.uri ||
        '[GFF3 URL]'
      dataCode = `# Load GFF3 features using rtracklayer
${dataVar}_gr <- rtracklayer::import(
  "${uri}",
  which = GenomicRanges::GRanges("${region?.refName}:${(region?.start || 0) + 1}-${region?.end}")
)

# Convert to tibble and standardize column names
${dataVar} <- tibble::as_tibble(${dataVar}_gr) |>
  dplyr::mutate(
    ref_name = as.character(seqnames),
    start = start - 1L,  # Convert to 0-based coordinates
    end = end,
    strand = dplyr::case_when(
      strand == "+" ~ 1L,
      strand == "-" ~ -1L,
      TRUE ~ 0L
    ),
    feature_id = ifelse(!is.na(ID), as.character(ID), paste0("feat_", dplyr::row_number())),
    name = dplyr::coalesce(
      if("Name" %in% names(.)) as.character(Name) else NA_character_,
      if("gene_name" %in% names(.)) as.character(gene_name) else NA_character_,
      if("ID" %in% names(.)) as.character(ID) else NA_character_
    ),
    parent_id = if("Parent" %in% names(.)) as.character(Parent) else NA_character_
  ) |>
  dplyr::select(ref_name, start, end, strand, type, feature_id, name, parent_id)`
    } else if (adapterType === 'BedTabixAdapter' || adapterType === 'BedAdapter') {
      const uri =
        adapterConf.bedGzLocation?.uri ||
        adapterConf.bedLocation?.uri ||
        '[BED URL]'
      dataCode = `# Load BED features using rtracklayer
${dataVar}_gr <- rtracklayer::import(
  "${uri}",
  which = GenomicRanges::GRanges("${region?.refName}:${(region?.start || 0) + 1}-${region?.end}")
)

# Convert to tibble
${dataVar} <- tibble::as_tibble(${dataVar}_gr) |>
  dplyr::mutate(
    ref_name = as.character(seqnames),
    start = start - 1L,
    end = end,
    strand = dplyr::case_when(
      strand == "+" ~ 1L,
      strand == "-" ~ -1L,
      TRUE ~ 0L
    ),
    feature_id = paste0("feat_", dplyr::row_number())
  )`
    } else {
      dataCode = `# Load feature data
# Adapter type: ${adapterType}
# You may need to adjust this based on your data source
${dataVar} <- tibble::tibble(
  ref_name = character(),
  start = integer(),
  end = integer(),
  strand = integer(),
  type = character(),
  name = character(),
  feature_id = character(),
  parent_id = character()
)`
    }
  }

  // Determine if this looks like a gene track
  const isGeneTrack =
    adapterType?.includes('Gff3') ||
    trackName.toLowerCase().includes('gene') ||
    trackName.toLowerCase().includes('transcript')

  if (isGeneTrack) {
    plotCode = `# Gene track: ${trackName}
#
# Step 1: Compute non-overlapping layout
# This assigns each feature to a row so overlapping features stack vertically
${dataVar}_layout <- compute_layout(
  ${dataVar} |> dplyr::filter(type %in% c("gene", "mRNA", "transcript") | is.na(type)),
  start_col = "start",
  end_col = "end",
  padding = 500  # minimum gap between features in same row (bp)
)

# Step 2: Prepare subfeatures (exons, CDS, UTRs) for rendering
${dataVar}_subs <- ${dataVar} |>
  dplyr::filter(type %in% c("exon", "CDS", "five_prime_UTR", "three_prime_UTR", "UTR"))

# Link subfeatures to parent layout rows
if (nrow(${dataVar}_subs) > 0 && nrow(${dataVar}_layout) > 0) {
  parent_rows <- setNames(${dataVar}_layout$layout_row, ${dataVar}_layout$feature_id)
  ${dataVar}_subs <- ${dataVar}_subs |>
    dplyr::mutate(
      layout_row = sapply(parent_id, function(pid) {
        if (is.na(pid)) return(NA_real_)
        if (pid %in% names(parent_rows)) return(parent_rows[[pid]])
        NA_real_
      })
    ) |>
    dplyr::filter(!is.na(layout_row))
}

# Step 3: Create the plot
${plotVar} <- ggplot() +
  # Draw intron lines (backbone)
  geom_segment(
    data = ${dataVar}_layout,
    aes(x = start, xend = end, y = layout_row, yend = layout_row),
    color = "gray50", linewidth = 0.5
  ) +
  # Draw exons/CDS as boxes
  geom_rect(
    data = ${dataVar}_subs |> dplyr::filter(type %in% c("CDS", "exon")),
    aes(xmin = start, xmax = end,
        ymin = layout_row - 0.35, ymax = layout_row + 0.35),
    fill = "#c9a857", color = "#8b7355", linewidth = 0.3
  ) +
  # Draw UTRs as thinner boxes
  geom_rect(
    data = ${dataVar}_subs |> dplyr::filter(grepl("UTR", type, ignore.case = TRUE)),
    aes(xmin = start, xmax = end,
        ymin = layout_row - 0.2, ymax = layout_row + 0.2),
    fill = "#c9a857", color = "#8b7355", linewidth = 0.3, alpha = 0.6
  ) +
  # Add labels
  geom_text(
    data = ${dataVar}_layout |> dplyr::filter(!is.na(name)),
    aes(x = start, y = layout_row + 0.5, label = name),
    hjust = 0, size = 2.5
  ) +
  scale_x_genomic(region = region) +
  labs(title = "${trackName}", y = "Features") +
  theme_jbrowse_track() +
  theme(
    axis.text.y = element_blank(),
    axis.ticks.y = element_blank()
  )`
  } else {
    plotCode = `# Feature track: ${trackName}
#
# Compute layout to stack overlapping features
${dataVar}_layout <- compute_layout(${dataVar}, padding = 200)

# Create plot
${plotVar} <- ggplot(${dataVar}_layout) +
  geom_rect(
    aes(xmin = start, xmax = end,
        ymin = layout_row - 0.35, ymax = layout_row + 0.35),
    fill = "#E07A5F", color = "#B5563E", linewidth = 0.3
  ) +
  geom_text(
    data = ${dataVar}_layout |> dplyr::filter(!is.na(name)),
    aes(x = start, y = layout_row + 0.5, label = name),
    hjust = 0, size = 2.5
  ) +
  scale_x_genomic(region = region) +
  labs(title = "${trackName}") +
  theme_jbrowse_track() +
  theme(
    axis.text.y = element_blank(),
    axis.ticks.y = element_blank()
  )`
  }

  return {
    trackId,
    trackName,
    displayType: 'LinearBasicDisplay',
    packages,
    dataCode,
    plotCode,
    dataVariable: dataVar,
    plotVariable: plotVar,
  }
}
