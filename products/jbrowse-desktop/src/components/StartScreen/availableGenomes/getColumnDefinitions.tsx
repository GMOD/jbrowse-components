import Check from '@mui/icons-material/Check'
import Close from '@mui/icons-material/Close'
import { Tooltip } from '@mui/material'
import { green, red } from '@mui/material/colors'

import GenomeNameCell from './GenomeNameCell.tsx'
import StarIcon from '../StarIcon.tsx'

import type { LaunchCallback } from '../types.ts'

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
  favorite: boolean
}

export interface GenomeColumn {
  id: keyof Entry
  header: string
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
      { id: 'scientificName', header: 'Scientific Name' },
      { id: 'organism', header: 'Organism' },
      { id: 'description', header: 'Description' },
    ]
  } else {
    const baseColumns: GenomeColumn[] = [
      favoriteColumn,
      {
        id: 'commonName',
        header: 'Common Name',
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
      { id: 'assemblyStatus', header: 'Assembly Status' },
      {
        id: 'seqReleaseDate',
        header: 'Release Date',
        cell: row =>
          row.seqReleaseDate
            ? new Date(row.seqReleaseDate).toISOString().split('T')[0]
            : '',
      },
      { id: 'scientificName', header: 'Scientific Name' },
      { id: 'ncbiAssemblyName', header: 'NCBI Assembly Name' },
    ]

    const extraColumns: GenomeColumn[] = [
      { id: 'accession', header: 'Accession' },
      { id: 'taxonId', header: 'Taxonomy ID' },
      { id: 'submitterOrg', header: 'Submitter' },
    ]

    return showAllColumns ? [...baseColumns, ...extraColumns] : baseColumns
  }
}
