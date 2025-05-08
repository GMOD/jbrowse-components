import { useState } from 'react'

import { notEmpty, useLocalStorage } from '@jbrowse/core/util'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { Button, Checkbox, IconButton, Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

import { useInnerDims } from '../availableGenomes/util'

import type { Fav, LaunchCallback } from '../types'

const useStyles = makeStyles()(theme => ({
  button: {
    margin: theme.spacing(2),
  },
  panel: {
    marginTop: theme.spacing(2),
    overflow: 'auto',
  },
  mb: {
    marginBottom: 5,
  },
  p0: {
    padding: 0,
  },
  headerContainer: {
    display: 'flex',
    alignItems: 'center',
  },
  toggleButton: {
    padding: theme.spacing(0.5),
  },
  cell: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginLeft: 20,
  },
}))

export default function FavoriteGenomesPanel({
  favorites,
  launch,
}: {
  favorites: Fav[]
  launch: LaunchCallback
}) {
  const { classes } = useStyles()
  const [selected, setSelected] = useState({} as Record<string, boolean>)
  const [isVisible, setIsVisible] = useLocalStorage(
    'startScreen-favMinimized',
    true,
  )
  const { height: innerHeight } = useInnerDims()
  const favMap = Object.fromEntries(favorites.map(r => [r.id, r]))

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
        {isVisible ? (
          <Button
            className={classes.button}
            variant="contained"
            disabled={!Object.values(selected).some(Boolean)}
            onClick={() => {
              launch(
                Object.entries(selected)
                  .filter(([_key, val]) => !!val)
                  .map(([key]) => favMap[key])
                  .filter(notEmpty),
              )
            }}
          >
            Go
          </Button>
        ) : null}
      </div>

      {isVisible ? (
        <>
          <div className={classes.panel} style={{ maxHeight: innerHeight / 4 }}>
            <table>
              <tbody>
                {favorites.map(({ id, shortName, description }) => (
                  <tr key={id}>
                    <td>
                      <Checkbox
                        className={classes.p0}
                        checked={selected[id] || false}
                        onChange={() => {
                          setSelected({
                            ...selected,
                            [id]: !selected[id],
                          })
                        }}
                      />
                    </td>
                    <td>{shortName}</td>
                    <td>
                      <div className={classes.cell}>{description}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  )
}
