import Check from '@mui/icons-material/Check'
import Close from '@mui/icons-material/Close'
import { Tooltip } from '@mui/material'
import { green, red } from '@mui/material/colors'

import StarIcon from '../StarIcon.tsx'
import GenomeNameCell from './GenomeNameCell.tsx'

import type { LaunchCallback } from '../types.ts'

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

export interface GenomeColumn {
  id: string
  header: string
  // plain-text accessor used for the default cell and for default sorting;
  // columns with a custom `cell` (favorite) omit it
  value?: (row: Entry) => string | undefined
  cell?: (row: Entry) => React.ReactNode
  sortFn?: (a: Entry, b: Entry) => number
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
function NcbiBadges({ row }: { row: Entry }) {
  return (
    <>
      {row.ncbiRefSeqCategory === 'reference genome' ? (
        <Tooltip title="NCBI designated reference">
          <Check style={{ color: green[600] }} />
        </Tooltip>
      ) : null}
      {row.suppressed ? (
        <Tooltip title="NCBI RefSeq suppressed">
          <Close style={{ color: red[600] }} />
        </Tooltip>
      ) : null}
    </>
  )
}

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
}): GenomeColumn[] {
  const favoriteColumn: GenomeColumn = {
    id: 'favorite',
    header: 'Favorite',
    sortFn: (a, b) => {
      const aIsFav = favs.has(a.accession)
      const bIsFav = favs.has(b.accession)
      return aIsFav === bIsFav ? 0 : aIsFav ? -1 : 1
    },
    cell: row => (
      <StarIcon
        isFavorite={favs.has(row.accession)}
        onClick={() => {
          toggleFavorite(row)
        }}
      />
    ),
  }

  const taxonIdColumn: GenomeColumn = {
    id: 'taxonId',
    header: 'Taxonomy ID',
    value: r => r.taxonId?.toString(),
  }

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
  }): GenomeColumn => ({
    id,
    header,
    value,
    cell: row => (
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

  // Cross-group results: rows arrive from the search index with only the fields
  // it carries, so the columns are the intersection of both shapes plus the
  // group each hit came from.
  if (groupTitles) {
    const baseColumns: GenomeColumn[] = [
      favoriteColumn,
      commonNameColumn(row => row.source === 'ucsc'),
      {
        id: 'source',
        header: 'Group',
        value: r => (r.source ? groupTitles.get(r.source) : undefined),
      },
      {
        id: 'scientificName',
        header: 'Scientific name',
        value: r => r.scientificName,
      },
      {
        id: 'ncbiAssemblyName',
        header: 'Assembly',
        value: r => r.ncbiAssemblyName,
      },
      { id: 'accession', header: 'Accession', value: r => r.accession },
    ]

    const extraColumns: GenomeColumn[] = [
      {
        id: 'assemblyStatus',
        header: 'Assembly status',
        value: r => r.assemblyStatus,
      },
      taxonIdColumn,
    ]

    return showAllColumns ? [...baseColumns, ...extraColumns] : baseColumns
  } else if (typeOption === 'ucsc') {
    const baseColumns: GenomeColumn[] = [
      favoriteColumn,
      nameColumn({
        id: 'name',
        header: 'Name',
        value: r => r.name,
        isUcsc: () => true,
      }),
      {
        id: 'scientificName',
        header: 'Scientific name',
        value: r => r.scientificName,
      },
      { id: 'organism', header: 'Organism', value: r => r.organism },
      { id: 'description', header: 'Description', value: r => r.description },
    ]

    const extraColumns: GenomeColumn[] = [
      { id: 'sourceName', header: 'Source', value: r => r.sourceName },
      taxonIdColumn,
    ]

    return showAllColumns ? [...baseColumns, ...extraColumns] : baseColumns
  } else {
    const baseColumns: GenomeColumn[] = [
      favoriteColumn,
      commonNameColumn(() => false),
      {
        id: 'assemblyStatus',
        header: 'Assembly status',
        value: r => r.assemblyStatus,
      },
      {
        id: 'seqReleaseDate',
        header: 'Release date',
        value: r => formatReleaseDate(r.seqReleaseDate),
      },
      {
        id: 'scientificName',
        header: 'Scientific name',
        value: r => r.scientificName,
      },
      {
        id: 'ncbiAssemblyName',
        header: 'NCBI assembly name',
        value: r => r.ncbiAssemblyName,
      },
    ]

    const extraColumns: GenomeColumn[] = [
      { id: 'accession', header: 'Accession', value: r => r.accession },
      {
        id: 'pairedAccession',
        header: 'Paired accession',
        value: r => r.pairedAccession,
      },
      taxonIdColumn,
      { id: 'submitterOrg', header: 'Submitter', value: r => r.submitterOrg },
    ]

    return showAllColumns ? [...baseColumns, ...extraColumns] : baseColumns
  }
}
