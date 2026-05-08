import React from 'react'

import { CascadingMenuButton } from '@jbrowse/core/ui'
import Check from '@mui/icons-material/Check'
import Close from '@mui/icons-material/Close'
import MoreHoriz from '@mui/icons-material/MoreHoriz'
import { Link, Tooltip } from '@mui/material'

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

          const handleLaunch = () => {
            launch([{ jbrowseConfig: row.jbrowseConfig, shortName: row.id }])
            onClose()
          }

          const handleMinimalLaunch = () => {
            launch([
              {
                jbrowseConfig: row.jbrowseMinimalConfig!,
                shortName: row.id,
              },
            ])
            onClose()
          }
          return (
            <div>
              {row.name} (
              <Link
                href="#"
                onClick={e => {
                  e.preventDefault()
                  handleLaunch()
                }}
              >
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
        cell: row => {
          const isFavorite = favs.has(row.id)
          const websiteUrl = `https://genomes.jbrowse.org/accession/${row.accession}/`

          const handleLaunch = () => {
            launch([
              {
                jbrowseConfig: row.jbrowseConfig,
                shortName: row.accession,
              },
            ])
            onClose()
          }

          const handleMinimalLaunch = () => {
            launch([
              {
                jbrowseConfig: row.jbrowseMinimalConfig!,
                shortName: row.accession,
              },
            ])
            onClose()
          }

          return (
            <div>
              {row.commonName} (
              <Link
                href="#"
                onClick={e => {
                  e.preventDefault()
                  handleLaunch()
                }}
              >
                launch
              </Link>
              )
              {row.jbrowseMinimalConfig ? (
                <>
                  {' '}
                  (
                  <Link
                    href="#"
                    onClick={e => {
                      e.preventDefault()
                      handleMinimalLaunch()
                    }}
                  >
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
