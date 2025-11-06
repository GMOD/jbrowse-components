import { CascadingMenuButton } from '@jbrowse/core/ui'
import { useLocalStorage } from '@jbrowse/core/util'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import MoreHoriz from '@mui/icons-material/MoreHoriz'
import { IconButton, Link, Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

import type { Fav, LaunchCallback } from '../types'

const useStyles = makeStyles()(theme => ({
  panel: {
    marginTop: theme.spacing(2),
  },
  mb: {
    marginBottom: 5,
  },
  tableContainer: {
    overflow: 'auto',
  },
  headerContainer: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
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
          <div className={classes.tableContainer}>
            <table>
              <tbody>
                {[...favorites]
                  .sort((a, b) => {
                    const nameA = [a.shortName, a.description, a.commonName]
                      .filter(f => !!f)
                      .join(' - ')
                    const nameB = [b.shortName, b.description, b.commonName]
                      .filter(f => !!f)
                      .join(' - ')
                    return nameA.localeCompare(nameB)
                  })
                  .map(
                    ({
                      id,
                      shortName,
                      description,
                      commonName,
                      jbrowseConfig,
                      jbrowseMinimalConfig,
                    }) => {
                      const name = [shortName, description, commonName]
                        .filter(f => !!f)
                        .join(' - ')

                      const handleLaunch = () => {
                        launch([
                          {
                            shortName,
                            jbrowseConfig,
                          },
                        ])
                      }

                      const handleMinimalLaunch = () => {
                        if (jbrowseMinimalConfig) {
                          launch([
                            {
                              shortName,
                              jbrowseConfig: jbrowseMinimalConfig,
                            },
                          ])
                        }
                      }

                      const handleRemove = () => {
                        setFavorites(favorites.filter(fav => fav.id !== id))
                      }

                      return (
                        <tr key={id}>
                          <td>
                            <Link
                              href="#"
                              onClick={event => {
                                event.preventDefault()
                                handleLaunch()
                              }}
                            >
                              {name}
                            </Link>{' '}
                            <CascadingMenuButton
                              style={{ padding: 0 }}
                              menuItems={[
                                {
                                  label: 'Launch (full config)',
                                  onClick: handleLaunch,
                                },
                                ...(jbrowseMinimalConfig
                                  ? [
                                      {
                                        label: 'Launch (minimal config)',
                                        onClick: handleMinimalLaunch,
                                      },
                                    ]
                                  : []),
                                {
                                  label: 'Remove from favorites',
                                  onClick: handleRemove,
                                },
                              ]}
                            >
                              <MoreHoriz />
                            </CascadingMenuButton>
                          </td>
                        </tr>
                      )
                    },
                  )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
