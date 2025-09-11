import { CascadingMenuButton } from '@jbrowse/core/ui'
import DataGridFlexContainer from '@jbrowse/core/ui/DataGridFlexContainer'
import { useLocalStorage } from '@jbrowse/core/util'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import MoreHoriz from '@mui/icons-material/MoreHoriz'
import { IconButton, Link, Typography } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { makeStyles } from 'tss-react/mui'

import type { Fav, LaunchCallback } from '../types'

const useStyles = makeStyles()(theme => ({
  panel: {
    marginTop: theme.spacing(2),
  },
  mb: {
    marginBottom: 5,
  },
  headerContainer: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
  },
  linkText: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
}))

export default function FavoriteGenomesPanel({
  favorites,
  setFavorites,
  launch,
}: {
  favorites: Fav[]
  setFavorites: (arg: Fav[]) => void
  launch: LaunchCallback
}) {
  const { classes } = useStyles()
  const [isVisible, setIsVisible] = useLocalStorage(
    'startScreen-favMinimized',
    true,
  )
  console.log(favorites)

  return (
    <div>
      <div
        className={classes.headerContainer}
        onClick={() => {
          setIsVisible(!isVisible)
        }}
      >
        <IconButton size="small">
          {isVisible ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
        <Typography variant="h6" className={classes.mb}>
          Favorite genomes
        </Typography>
      </div>

      {isVisible ? (
        <div className={classes.panel}>
          <DataGrid
            rows={favorites.map(
              ({ id, shortName, description, commonName, jbrowseConfig }) => ({
                id,
                name: [shortName, description, commonName]
                  .filter(f => !!f)
                  .join(' - '),
                shortName,
                description,
                jbrowseConfig,
              }),
            )}
            columns={[
              {
                field: 'name',
                headerName: 'Genome',
                flex: 1,
                renderCell: ({ row }: any) => {
                  const handleLaunch = () => {
                    launch([
                      {
                        shortName: row.shortName,
                        jbrowseConfig: row.jbrowseConfig,
                      },
                    ])
                  }

                  return (
                    <Link
                      href="#"
                      className={classes.linkText}
                      onClick={event => {
                        event.preventDefault()
                        handleLaunch()
                      }}
                    >
                      {row.name}
                    </Link>
                  )
                },
              },
              {
                field: 'actions',
                headerName: '',
                width: 50,
                sortable: false,
                renderCell: ({ row }: any) => {
                  const handleLaunch = () => {
                    launch([
                      {
                        shortName: row.shortName,
                        jbrowseConfig: row.jbrowseConfig,
                      },
                    ])
                  }

                  const handleRemove = () => {
                    setFavorites(favorites.filter(fav => fav.id !== row.id))
                  }

                  return (
                    <CascadingMenuButton
                      style={{ padding: 0, margin: 0 }}
                      menuItems={[
                        {
                          label: 'Launch',
                          onClick: handleLaunch,
                        },
                        {
                          label: 'Remove from favorites',
                          onClick: handleRemove,
                        },
                      ]}
                    >
                      <MoreHoriz />
                    </CascadingMenuButton>
                  )
                },
              },
            ]}
            rowHeight={25}
            columnHeaderHeight={32}
            hideFooter
            disableColumnMenu
            disableRowSelectionOnClick
          />
        </div>
      ) : null}
    </div>
  )
}
