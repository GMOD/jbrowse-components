import React from 'react'

import { CascadingMenuButton } from '@jbrowse/core/ui'
import Check from '@mui/icons-material/Check'
import Close from '@mui/icons-material/Close'
import MoreHoriz from '@mui/icons-material/MoreHoriz'
import { Link, Tooltip } from '@mui/material'
import { createColumnHelper } from '@tanstack/react-table'

import StarIcon from '../StarIcon'

import type { LaunchCallback } from '../types'

interface Entry {
  suppressed: boolean
  jbrowseConfig: string
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

function highlightText(text: string, query: string): React.ReactNode {
  if (!query || !text) {
    return text
  }

  const queryLower = query.toLowerCase().trim()
  const textLower = text.toLowerCase()

  const index = textLower.indexOf(queryLower)
  if (index === -1) {
    return text
  }

  const beforeMatch = text.slice(0, Math.max(0, index))
  const match = text.slice(index, index + query.length)
  const afterMatch = text.slice(Math.max(0, index + query.length))

  return (
    <>
      {beforeMatch}
      <mark style={{ backgroundColor: 'yellow' }}>{match}</mark>
      {highlightText(afterMatch, query)}
    </>
  )
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
  toggleFavorite: (row: any) => void
  launch: LaunchCallback
  onClose: () => void
  searchQuery: string
  showAllColumns: boolean
}) {
  const columnHelper = createColumnHelper<Entry>()

  if (typeOption === 'mainGenomes') {
    return [
      columnHelper.accessor('favorite', {
        header: 'Favorite',
        sortingFn: (a, b) => {
          const aIsFav = favs.has(a.original.id)
          const bIsFav = favs.has(b.original.id)
          return aIsFav === bIsFav ? 0 : aIsFav ? -1 : 1
        },
        cell: info => {
          const row = info.row.original
          const isFavorite = favs.has(row.id)
          const handleToggleFavorite = () => {
            toggleFavorite(row)
          }
          return (
            <StarIcon isFavorite={isFavorite} onClick={handleToggleFavorite} />
          )
        },
      }),
      columnHelper.accessor('name', {
        header: 'Name',
        cell: info => {
          const row = info.row.original
          const isFavorite = favs.has(row.id)
          const websiteUrl = `https://genomes.jbrowse.org/ucsc/${row.id}/`

          const handleLaunch = (event: React.MouseEvent) => {
            event.preventDefault()
            launch([
              {
                jbrowseConfig: row.jbrowseConfig,
                shortName: row.id,
              },
            ])
            onClose()
          }

          return (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {highlightText(info.getValue() || '', searchQuery)} (
              <Link href={websiteUrl} target="_blank">
                info
              </Link>
              )(
              <Link href="#" onClick={handleLaunch}>
                launch
              </Link>
              )
              <CascadingMenuButton
                menuItems={[
                  {
                    label: 'Launch',
                    onClick: handleLaunch,
                  },
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
      }),
      columnHelper.accessor('scientificName', {
        header: 'Scientific Name',
        cell: info => highlightText(info.getValue() || '', searchQuery),
      }),
      columnHelper.accessor('organism', {
        header: 'Organism',
        cell: info => highlightText(info.getValue() || '', searchQuery),
      }),
      columnHelper.accessor('description', {
        header: 'Description',
        cell: info => highlightText(info.getValue() || '', searchQuery),
      }),
    ]
  } else {
    const baseColumns = [
      columnHelper.accessor('favorite', {
        header: 'Favorite',
        sortingFn: (a, b) => {
          const aIsFav = favs.has(a.original.id)
          const bIsFav = favs.has(b.original.id)
          return aIsFav === bIsFav ? 0 : aIsFav ? -1 : 1
        },
        cell: info => {
          const row = info.row.original
          const isFavorite = favs.has(row.id)
          const handleToggleFavorite = () => {
            toggleFavorite(row)
          }
          return (
            <StarIcon isFavorite={isFavorite} onClick={handleToggleFavorite} />
          )
        },
      }),
      columnHelper.accessor('commonName', {
        header: 'Common Name',
        cell: info => {
          const row = info.row.original
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

          return (
            <div>
              {highlightText(info.getValue() || '', searchQuery)} (
              <Link href={websiteUrl} target="_blank">
                info
              </Link>
              ) (
              <Link href="#" onClick={handleLaunch}>
                launch
              </Link>
              )
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
                    label: 'Launch',
                    onClick: handleLaunch,
                  },
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
      }),

      columnHelper.accessor('assemblyStatus', { header: 'Assembly Status' }),
      columnHelper.accessor('seqReleaseDate', {
        header: 'Release Date',
        cell: info => {
          const date = info.getValue()
          if (!date) {
            return ''
          }
          // Parse the date and format it to show only the date part (YYYY-MM-DD)
          const dateObj = new Date(date)
          return dateObj.toISOString().split('T')[0]
        },
      }),
      columnHelper.accessor('scientificName', {
        header: 'Scientific Name',
        cell: info => highlightText(info.getValue() || '', searchQuery),
      }),
      columnHelper.accessor('ncbiAssemblyName', {
        header: 'NCBI Assembly Name',
        cell: info => highlightText(info.getValue() || '', searchQuery),
      }),
    ]

    const extraColumns = [
      columnHelper.accessor('accession', { header: 'Accession' }),
      columnHelper.accessor('taxonId', { header: 'Taxonomy ID' }),
      columnHelper.accessor('submitterOrg', { header: 'Submitter' }),
    ]

    return showAllColumns ? [...baseColumns, ...extraColumns] : baseColumns
  }
}
