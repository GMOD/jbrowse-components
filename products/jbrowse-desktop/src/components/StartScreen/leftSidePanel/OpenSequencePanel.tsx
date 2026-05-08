import { useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button } from '@mui/material'

import OpenSequenceDialog from '../../OpenSequenceDialog.tsx'
import AllGenomesDialog from '../availableGenomes/AvailableGenomesDialog.tsx'

import type { Fav, JBrowseConfig, LaunchCallback } from '../types.ts'

const useStyles = makeStyles()({
  button: {
    margin: 5,
    display: 'block',
  },
})

export default function OpenSequencePanel({
  favorites,
  setFavorites,
  launch,
  launchFromSnap,
}: {
  favorites: Fav[]
  setFavorites: (arg: Fav[]) => void
  launch: LaunchCallback
  launchFromSnap: (snap: JBrowseConfig) => void
}) {
  const { classes } = useStyles()
  const [sequenceDialogOpen, setSequenceDialogOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)

  return (
    <div>
      <Button
        variant="contained"
        color="primary"
        className={classes.button}
        onClick={() => {
          setSequenceDialogOpen(true)
        }}
      >
        Open new genome
      </Button>
      <Button
        variant="contained"
        className={classes.button}
        onClick={() => {
          setShowAll(true)
        }}
      >
        Show all available genomes
      </Button>

      {sequenceDialogOpen ? (
        <OpenSequenceDialog
          onClose={(conf: unknown) => {
            if (conf) {
              launchFromSnap({
                assemblies: conf as JBrowseConfig['assemblies'],
                defaultSession: {
                  name: `New Session ${new Date().toLocaleString('en-US')}`,
                },
              })
            }
            setSequenceDialogOpen(false)
          }}
        />
      ) : null}

      {showAll ? (
        <AllGenomesDialog
          favorites={favorites}
          setFavorites={setFavorites}
          launch={launch}
          onClose={() => {
            setShowAll(false)
          }}
        />
      ) : null}
    </div>
  )
}
