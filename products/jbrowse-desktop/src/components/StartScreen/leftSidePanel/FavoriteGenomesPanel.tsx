import { CascadingMenuButton } from '@jbrowse/core/ui'
import { useLocalStorage } from '@jbrowse/core/util'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import MoreHoriz from '@mui/icons-material/MoreHoriz'
import { IconButton, Link, Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

import { useInnerDims } from '../availableGenomes/util'

import type { Fav, LaunchCallback } from '../types'

const useStyles = makeStyles()(theme => ({
  panel: {
    marginTop: theme.spacing(2),
    overflow: 'auto',
  },
  mb: {
    marginBottom: 5,
  },

  headerContainer: {
    display: 'flex',
    alignItems: 'center',
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
  const { height: innerHeight } = useInnerDims()

  return (
    <div>
      <div className={classes.headerContainer}>
        <IconButton
          size="small"
          onClick={() => {
            setIsVisible(!isVisible)
          }}
        >
          {isVisible ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
        <Typography variant="h6" className={classes.mb}>
          Favorite genomes
        </Typography>
      </div>

      {isVisible ? (
        <>
          <div className={classes.panel} style={{ maxHeight: innerHeight / 4 }}>
            <table>
              <tbody>
                {favorites.map(
                  ({ id, shortName, description, jbrowseConfig }) => {
                    const handleLaunch = () => {
                      launch([
                        {
                          shortName,
                          jbrowseConfig,
                        },
                      ])
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
                            {[shortName, description]
                              .filter(f => !!f)
                              .join(' - ')}
                          </Link>{' '}
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
                        </td>
                      </tr>
                    )
                  },
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  )
}
