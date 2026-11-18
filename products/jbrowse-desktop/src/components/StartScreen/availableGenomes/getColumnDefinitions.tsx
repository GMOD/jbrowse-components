import { CellOverhang } from '@jbrowse/core/ui/VirtualTable'
import { cellText } from '@jbrowse/core/util/tableText'
import Check from '@mui/icons-material/Check'
import Close from '@mui/icons-material/Close'
import { Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import StarIcon from '../StarIcon.tsx'
import GenomeNameCell from './GenomeNameCell.tsx'

import type { LaunchCallback } from '../types.ts'
import type { VirtualTableColumn } from '@jbrowse/core/ui/VirtualTable'

// ISO datetime -> YYYY-MM-DD (first 10 chars); empty for missing or
// unparsable values (guards against `toISOString()` throwing RangeError)
function formatReleaseDate(date?: string) {
  const d = date ? new Date(date) : undefined
  return d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : ''
}

/**
 * One row of a genome list. UCSC main genomes and GenArk/NCBI assemblies come
 * from the same endpoint shape but populate disjoint halves of it, so whatever
 * only one side supplies is optional. `accession` doubles as the row key: UCSC
 * entries put their db name there (`hg38`), GenArk entries the assembly
 * accession (`GCF_000951035.1`).
 */
export interface Entry {
  accession: string
  jbrowseConfig: string
  jbrowseMinimalConfig?: string
  taxonId?: number
  commonName: string
  scientificName: string

  // UCSC main genomes only. orderKey is UCSC's own display ordering, and
  // sourceName is its assembly provenance line, which for 69 of the 236 dbs
  // ends in the GC[AF] accession that names the same assembly at NCBI.
  name?: string
  organism?: string
  description?: string
  sourceName?: string
  orderKey?: number

  // the group this row came from. processHubJson stamps it on GenArk rows
  // ('primates', or 'uncategorized' for a non-main category); UCSC rows only
  // carry it when they arrive via the cross-group search index.
  source?: string

  // GenArk/NCBI only. pairedAccession is the GCA of a GCF entry (or vice
  // versa) — the same assembly under the other authority's accession.
  ncbiName?: string
  ncbiAssemblyName?: string
  ncbiRefSeqCategory?: string
  assemblyStatus?: string
  seqReleaseDate?: string
  submitterOrg?: string
  pairedAccession?: string
  suppressed?: boolean
}

export interface GenomeRow extends Entry {
  id: string
}

export type GenomeColumn = VirtualTableColumn<Entry>

// each column's width; the column naming the row takes what the rest leave,
// so a long GenArk name keeps its launch link in view
export const columnWidths: Record<string, number> = {
  favorite: 96,
  name: 260,
  commonName: 260,
  scientificName: 200,
  organism: 130,
  description: 220,
  sourceName: 260,
  taxonId: 110,
  source: 200,
  ncbiAssemblyName: 170,
  accession: 150,
  assemblyStatus: 140,
  seqReleaseDate: 120,
  pairedAccession: 150,
  submitterOrg: 220,
}

function textColumn(
  id: string,
  header: string,
  value: (row: Entry) => string | number | undefined,
) {
  return {
    id,
    header,
    sortValue: value,
    cell: value,
    title: (row: Entry) => cellText(value(row)),
  }
}

// genomes.jbrowse.org keys UCSC main genomes by db name and everything else by
// assembly accession
function websiteUrl(accession: string, isUcsc: boolean) {
  return isUcsc
    ? `https://genomes.jbrowse.org/ucsc/${accession}/`
    : `https://genomes.jbrowse.org/accession/${accession}/`
}

// NCBI's verdict on the assembly, shown beside the name. Only GenArk/NCBI rows
// carry these fields, so the UCSC main genomes render nothing here.
const NcbiBadges = observer(function NcbiBadges({ row }: { row: Entry }) {
  return (
    <>
      {row.ncbiRefSeqCategory === 'reference genome' ? (
        <Tooltip title="NCBI designated reference">
          <Check color="success" />
        </Tooltip>
      ) : null}
      {row.suppressed ? (
        <Tooltip title="NCBI RefSeq suppressed">
          <Close color="error" />
        </Tooltip>
      ) : null}
    </>
  )
})

export function getColumnDefinitions({
  typeOption,
  favs,
  toggleFavorite,
  launch,
  onClose,
  showAllColumns,
  groupTitles,
}: {
  typeOption: string
  favs: Set<string>
  toggleFavorite: (row: Entry) => void
  launch: LaunchCallback
  onClose: () => void
  showAllColumns: boolean
  // set only for cross-group results, where rows come from several groups and
  // the group each one belongs to becomes a column
  groupTitles?: Map<string, string>
}) {
  const favoriteColumn: GenomeColumn = {
    id: 'favorite',
    header: 'Favorite',
    sortValue: row => (favs.has(row.accession) ? 0 : 1),
    cell: row => (
      <CellOverhang>
        <StarIcon
          isFavorite={favs.has(row.accession)}
          onClick={() => {
            toggleFavorite(row)
          }}
        />
      </CellOverhang>
    ),
  }

  const taxonIdColumn = textColumn('taxonId', 'Taxonomy ID', r => r.taxonId)

  // The column that names a row is also the one that launches it, and it is the
  // same cell in all three shapes below. Only three things vary: which field
  // names the row, whether the NCBI badges apply, and which half of
  // genomes.jbrowse.org "More info" points at — and `isUcsc` is per-row rather
  // than per-table because cross-group hits come from both halves at once.
  const nameColumn = ({
    id,
    header,
    value,
    isUcsc,
    badges = false,
  }: {
    id: string
    header: string
    value: (row: Entry) => string | undefined
    isUcsc: (row: Entry) => boolean
    badges?: boolean
  }) => ({
    id,
    header,
    fill: true,
    sortValue: value,
    title: (row: Entry) => cellText(value(row)),
    cell: (row: Entry) => (
      <GenomeNameCell
        displayName={value(row)}
        jbrowseConfig={row.jbrowseConfig}
        jbrowseMinimalConfig={row.jbrowseMinimalConfig}
        websiteUrl={websiteUrl(row.accession, isUcsc(row))}
        isFavorite={favs.has(row.accession)}
        launch={launch}
        onClose={onClose}
        toggleFavorite={() => {
          toggleFavorite(row)
        }}
      >
        {badges ? <NcbiBadges row={row} /> : null}
      </GenomeNameCell>
    ),
  })

  const commonNameColumn = (isUcsc: (row: Entry) => boolean) =>
    nameColumn({
      id: 'commonName',
      header: 'Common name',
      value: r => r.commonName,
      isUcsc,
      badges: true,
    })

  // Each shape below names the columns it always shows and the ones "Show all
  // columns" appends. Which of the two lists is in play is the same decision in
  // all three, so it is stated here instead of at the end of each branch.
  const visible = (base: GenomeColumn[], extra: GenomeColumn[]) =>
    showAllColumns ? [...base, ...extra] : base

  // Cross-group results: rows arrive from the search index with only the fields
  // it carries, so the columns are the intersection of both shapes plus the
  // group each hit came from.
  if (groupTitles) {
    return visible(
      [
        favoriteColumn,
        commonNameColumn(row => row.source === 'ucsc'),
        textColumn('source', 'Group', r =>
          r.source ? groupTitles.get(r.source) : undefined,
        ),
        textColumn('scientificName', 'Scientific name', r => r.scientificName),
        textColumn('ncbiAssemblyName', 'Assembly', r => r.ncbiAssemblyName),
        textColumn('accession', 'Accession', r => r.accession),
      ],
      [
        textColumn('assemblyStatus', 'Assembly status', r => r.assemblyStatus),
        taxonIdColumn,
      ],
    )
  } else if (typeOption === 'ucsc') {
    return visible(
      [
        favoriteColumn,
        nameColumn({
          id: 'name',
          header: 'Name',
          value: r => r.name,
          isUcsc: () => true,
        }),
        textColumn('scientificName', 'Scientific name', r => r.scientificName),
        textColumn('organism', 'Organism', r => r.organism),
        textColumn('description', 'Description', r => r.description),
      ],
      [textColumn('sourceName', 'Source', r => r.sourceName), taxonIdColumn],
    )
  } else {
    return visible(
      [
        favoriteColumn,
        commonNameColumn(() => false),
        textColumn('assemblyStatus', 'Assembly status', r => r.assemblyStatus),
        textColumn('seqReleaseDate', 'Release date', r =>
          formatReleaseDate(r.seqReleaseDate),
        ),
        textColumn('scientificName', 'Scientific name', r => r.scientificName),
        textColumn(
          'ncbiAssemblyName',
          'NCBI assembly name',
          r => r.ncbiAssemblyName,
        ),
      ],
      [
        textColumn('accession', 'Accession', r => r.accession),
        textColumn(
          'pairedAccession',
          'Paired accession',
          r => r.pairedAccession,
        ),
        taxonIdColumn,
        textColumn('submitterOrg', 'Submitter', r => r.submitterOrg),
      ],
    )
  }
}
