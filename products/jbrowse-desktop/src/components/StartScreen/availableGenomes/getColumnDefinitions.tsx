import React from 'react'

import { CascadingMenuButton } from '@jbrowse/core/ui'
import Check from '@mui/icons-material/Check'
import Close from '@mui/icons-material/Close'
import MoreHoriz from '@mui/icons-material/MoreHoriz'
import { Link, Tooltip } from '@mui/material'

import HighlightedText from './HighlightedText.tsx'
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
  searchQuery,
  showAllColumns,
}: {
  typeOption: string
  favs: Set<string>
  toggleFavorite: (row: Entry) => void
  launch: LaunchCallback
  onClose: () => void
  searchQuery: string
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
    cell: row => {
      const isFavorite = favs.has(row.id)
      return (
        <StarIcon
          isFavorite={isFavorite}
          onClick={() => {
            toggleFavorite(row)
          }}
        />
      )
    },
  }

  if (typeOption === 'ucsc') {
    return [
      favoriteColumn,
      {
        id: 'name',
        header: 'Name',
        cell: row => {
          const isFavorite = favs.has(row.id)
          const websiteUrl = `https://genomes.jbrowse.org/ucsc/${row.id}/`

          const handleLaunch = (event: React.MouseEvent) => {
            event.preventDefault()
            launch([{ jbrowseConfig: row.jbrowseConfig, shortName: row.id }])
            onClose()
          }

          const handleMinimalLaunch = (event: React.MouseEvent) => {
            event.preventDefault()
            if (row.jbrowseMinimalConfig) {
              launch([
                {
                  jbrowseConfig: row.jbrowseMinimalConfig,
                  shortName: row.id,
                },
              ])
              onClose()
            }
          }
          return (
            <div>
              <HighlightedText text={row.name || ''} query={searchQuery} /> (
              <Link href="#" onClick={handleLaunch}>
                launch
              </Link>
              )
              <CascadingMenuButton
                menuItems={[
                  {
                    label: 'More info',
                    helpText:
                      'Launches external web browser (not in-app) with more info about this instance',
                    onClick: () => {
                      window.open(websiteUrl, '_blank')
                    },
                  },
                  {
                    label: 'Launch',
                    onClick: handleLaunch,
                  },
                  ...(row.jbrowseMinimalConfig
                    ? [
                        {
                          label: 'Launch (minimal config)',
                          onClick: handleMinimalLaunch,
                        },
                      ]
                    : []),
                  {
                    label: isFavorite
                      ? 'Remove from favorites'
                      : 'Add to favorites',
                    onClick: () => {
                      toggleFavorite(row)
                    },
                  },
                ]}
              >
                <MoreHoriz />
              </CascadingMenuButton>
            </div>
          )
        },
      },
      {
        id: 'scientificName',
        header: 'Scientific Name',
        cell: row => (
          <HighlightedText
            text={row.scientificName || ''}
            query={searchQuery}
          />
        ),
      },
      {
        id: 'organism',
        header: 'Organism',
        cell: row => (
          <HighlightedText text={row.organism || ''} query={searchQuery} />
        ),
      },
      {
        id: 'description',
        header: 'Description',
        cell: row => (
          <HighlightedText text={row.description || ''} query={searchQuery} />
        ),
      },
    ]
  } else {
    const baseColumns: GenomeColumn[] = [
      favoriteColumn,
      {
        id: 'commonName',
        header: 'Common Name',
        cell: row => {
          const isFavorite = favs.has(row.id)
          const websiteUrl = `https://genomes.jbrowse.org/accession/${row.accession}/`

          const handleLaunch = (event: React.MouseEvent) => {
            event.preventDefault()
            launch([
              {
                jbrowseConfig: row.jbrowseConfig,
                shortName: row.accession,
              },
            ])
            onClose()
          }

          const handleMinimalLaunch = (event: React.MouseEvent) => {
            event.preventDefault()
            if (row.jbrowseMinimalConfig) {
              launch([
                {
                  jbrowseConfig: row.jbrowseMinimalConfig,
                  shortName: row.accession,
                },
              ])
              onClose()
            }
          }

          return (
            <div>
              <HighlightedText
                text={row.commonName || ''}
                query={searchQuery}
              />{' '}
              (
              <Link href="#" onClick={handleLaunch}>
                launch
              </Link>
              )
              {row.jbrowseMinimalConfig ? (
                <>
                  {' '}
                  (
                  <Link href="#" onClick={handleMinimalLaunch}>
                    minimal
                  </Link>
                  )
                </>
              ) : null}
              {row.ncbiRefSeqCategory === 'reference genome' ? (
                <Tooltip title="NCBI designated reference">
                  <Check style={{ color: 'green' }} />
                </Tooltip>
              ) : null}
              {row.suppressed ? (
                <Tooltip title="NCBI RefSeq suppressed">
                  <Close style={{ color: 'red' }} />
                </Tooltip>
              ) : null}
              <CascadingMenuButton
                menuItems={[
                  {
                    label: 'Info',
                    onClick: () => {
                      window.open(websiteUrl, '_blank')
                    },
                  },
                  {
                    label: 'Launch',
                    onClick: handleLaunch,
                  },
                  ...(row.jbrowseMinimalConfig
                    ? [
                        {
                          label: 'Launch (minimal)',
                          onClick: handleMinimalLaunch,
                        },
                      ]
                    : []),
                  {
                    label: isFavorite
                      ? 'Remove from favorites'
                      : 'Add to favorites',
                    onClick: () => {
                      toggleFavorite(row)
                    },
                  },
                ]}
              >
                <MoreHoriz />
              </CascadingMenuButton>
            </div>
          )
        },
      },
      {
        id: 'assemblyStatus',
        header: 'Assembly Status',
      },
      {
        id: 'seqReleaseDate',
        header: 'Release Date',
        cell: row => {
          const date = row.seqReleaseDate
          if (!date) {
            return ''
          }
          const dateObj = new Date(date)
          return dateObj.toISOString().split('T')[0]
        },
      },
      {
        id: 'scientificName',
        header: 'Scientific Name',
        cell: row => (
          <HighlightedText
            text={row.scientificName || ''}
            query={searchQuery}
          />
        ),
      },
      {
        id: 'ncbiAssemblyName',
        header: 'NCBI Assembly Name',
        cell: row => (
          <HighlightedText
            text={row.ncbiAssemblyName || ''}
            query={searchQuery}
          />
        ),
      },
    ]

    const extraColumns: GenomeColumn[] = [
      { id: 'accession', header: 'Accession' },
      { id: 'taxonId', header: 'Taxonomy ID' },
      { id: 'submitterOrg', header: 'Submitter' },
    ]

    return showAllColumns ? [...baseColumns, ...extraColumns] : baseColumns
  }
}
