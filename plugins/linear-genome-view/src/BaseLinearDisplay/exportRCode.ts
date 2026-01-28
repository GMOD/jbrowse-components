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
    packages = ['rtracklayer', 'ggjbrowse', 'ggplot2', 'tibble', 'dplyr']

    if (adapterType === 'Gff3TabixAdapter' || adapterType === 'Gff3Adapter') {
      const uri =
        adapterConf.gffGzLocation?.uri || adapterConf.gffLocation?.uri || '[GFF3 URL]'
      dataCode = `# Load GFF3 features using rtracklayer
${dataVar}_gr <- rtracklayer::import(
  "${uri}",
  which = GenomicRanges::GRanges("${region?.refName}:${(region?.start || 0) + 1}-${region?.end}")
)
${dataVar} <- tibble::as_tibble(${dataVar}_gr) |>
  dplyr::select(seqnames, start, end, strand, type, any_of(c("Name", "ID", "Parent", "gene_name", "gene_id"))) |>
  dplyr::rename(ref_name = seqnames) |>
  dplyr::mutate(
    start = start - 1,
    strand = dplyr::case_when(
      strand == "+" ~ 1L,
      strand == "-" ~ -1L,
      TRUE ~ 0L
    ),
    name = dplyr::coalesce(Name, gene_name, ID)
  )`
    } else if (adapterType === 'BedTabixAdapter' || adapterType === 'BedAdapter') {
      const uri =
        adapterConf.bedGzLocation?.uri || adapterConf.bedLocation?.uri || '[BED URL]'
      dataCode = `# Load BED features using rtracklayer
${dataVar}_gr <- rtracklayer::import(
  "${uri}",
  which = GenomicRanges::GRanges("${region?.refName}:${(region?.start || 0) + 1}-${region?.end}")
)
${dataVar} <- tibble::as_tibble(${dataVar}_gr) |>
  dplyr::select(seqnames, start, end, strand, any_of(c("name", "score"))) |>
  dplyr::rename(ref_name = seqnames) |>
  dplyr::mutate(
    start = start - 1,
    strand = dplyr::case_when(
      strand == "+" ~ 1L,
      strand == "-" ~ -1L,
      TRUE ~ 0L
    )
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
  name = character()
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
# Filter to show only gene-level features (adjust type filter as needed)
${plotVar} <- ggplot(
  ${dataVar} |> dplyr::filter(type %in% c("gene", "mRNA", "transcript", "exon") | is.na(type)),
  aes(xmin = start, xmax = end, y = strand, fill = type, label = name)
) +
  geom_gene() +
  scale_x_genomic(region = region) +
  scale_fill_brewer(palette = "Set2", na.value = "goldenrod") +
  labs(title = "${trackName}") +
  theme_jbrowse_track() +
  theme(legend.position = "none")`
  } else {
    plotCode = `# Feature track: ${trackName}
${plotVar} <- ggplot(
  ${dataVar},
  aes(xmin = start, xmax = end, y = strand, label = name)
) +
  geom_gene(fill = "steelblue") +
  scale_x_genomic(region = region) +
  labs(title = "${trackName}") +
  theme_jbrowse_track()`
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
