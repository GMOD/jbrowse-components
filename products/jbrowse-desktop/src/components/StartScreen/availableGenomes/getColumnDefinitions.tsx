import Check from '@mui/icons-material/Check'
import Close from '@mui/icons-material/Close'
import { Tooltip } from '@mui/material'
import { green, red } from '@mui/material/colors'

import GenomeNameCell from './GenomeNameCell.tsx'
import StarIcon from '../StarIcon.tsx'

import type { LaunchCallback } from '../types.ts'

// ISO datetime -> YYYY-MM-DD (first 10 chars); empty for missing or
// unparseable values (guards against `toISOString()` throwing RangeError)
function formatReleaseDate(date: string) {
  const d = date ? new Date(date) : undefined
  return d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : ''
}

export interface Entry {
  suppressed: boolean
  jbrowseConfig: string
  jbrowseMinimalConfig?: string
  accession: string
  commonName: string
  ncbiAssemblyName: string
  ncbiName: string
  ncbiRefSeqCategory: string
  id: string
  name: string
  scientificName: string
  organism: string
  description: string
  assemblyStatus: string
  seqReleaseDate: string
  taxonId: string
  submitterOrg: string
}

export interface GenomeColumn {
  id: string
  header: string
  // plain-text accessor used for the default cell and for default sorting;
  // columns with a custom `cell` (favorite, name) omit it
  value?: (row: Entry) => string
  cell?: (row: Entry) => React.ReactNode
  sortFn?: (a: Entry, b: Entry) => number
}

export function getColumnDefinitions({
  typeOption,
  favs,
  toggleFavorite,
  launch,
  onClose,
  showAllColumns,
}: {
  typeOption: string
  favs: Set<string>
  toggleFavorite: (row: Entry) => void
  launch: LaunchCallback
  onClose: () => void
  showAllColumns: boolean
}): GenomeColumn[] {
  const favoriteColumn: GenomeColumn = {
    id: 'favorite',
    header: 'Favorite',
    sortFn: (a, b) => {
      const aIsFav = favs.has(a.id)
      const bIsFav = favs.has(b.id)
      return aIsFav === bIsFav ? 0 : aIsFav ? -1 : 1
    },
    cell: row => (
      <StarIcon
        isFavorite={favs.has(row.id)}
        onClick={() => {
          toggleFavorite(row)
        }}
      />
    ),
  }

  if (typeOption === 'ucsc') {
    return [
      favoriteColumn,
      {
        id: 'name',
        header: 'Name',
        cell: row => (
          <GenomeNameCell
            displayName={row.name}
            shortName={row.id}
            jbrowseConfig={row.jbrowseConfig}
            jbrowseMinimalConfig={row.jbrowseMinimalConfig}
            websiteUrl={`https://genomes.jbrowse.org/ucsc/${row.id}/`}
            isFavorite={favs.has(row.id)}
            launch={launch}
            onClose={onClose}
            toggleFavorite={() => {
              toggleFavorite(row)
            }}
          />
        ),
      },
      {
        id: 'scientificName',
        header: 'Scientific name',
        value: r => r.scientificName,
      },
      { id: 'organism', header: 'Organism', value: r => r.organism },
      { id: 'description', header: 'Description', value: r => r.description },
    ]
  } else {
    const baseColumns: GenomeColumn[] = [
      favoriteColumn,
      {
        id: 'commonName',
        header: 'Common name',
        cell: row => (
          <GenomeNameCell
            displayName={row.commonName}
            shortName={row.accession}
            jbrowseConfig={row.jbrowseConfig}
            jbrowseMinimalConfig={row.jbrowseMinimalConfig}
            websiteUrl={`https://genomes.jbrowse.org/accession/${row.accession}/`}
            isFavorite={favs.has(row.id)}
            launch={launch}
            onClose={onClose}
            toggleFavorite={() => {
              toggleFavorite(row)
            }}
          >
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
          </GenomeNameCell>
        ),
      },
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
      { id: 'taxonId', header: 'Taxonomy ID', value: r => r.taxonId },
      { id: 'submitterOrg', header: 'Submitter', value: r => r.submitterOrg },
    ]

    return showAllColumns ? [...baseColumns, ...extraColumns] : baseColumns
  }
}
