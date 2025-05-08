import { useState } from 'react'

import { Button, Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

import OpenSequenceDialog from '../../OpenSequenceDialog'
import AllGenomesDialog from '../availableGenomes/AvailableGenomesDialog'
import { loadPluginManager } from '../util'

import type { Fav, LaunchCallback } from '../types'
import type PluginManager from '@jbrowse/core/PluginManager'

const { ipcRenderer } = window.require('electron')

const useStyles = makeStyles()({
  button: {
    margin: 5,
  },
})

export default function OpenSequencePanel({
  setPluginManager,
  favorites,
  setFavorites,
  launch,
}: {
  setPluginManager: (arg0: PluginManager) => void
  favorites: Fav[]
  setFavorites: (arg: Fav[]) => void
  launch: LaunchCallback
}) {
  const { classes } = useStyles()
  const [sequenceDialogOpen, setSequenceDialogOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)

  return (
    <div>
      <Typography variant="h6" style={{ marginBottom: 5 }}>
        Select a sequence file e.g. reference genome FASTA file
      </Typography>
      <Button
        variant="contained"
        color="primary"
        className={classes.button}
        onClick={() => {
          setSequenceDialogOpen(true)
        }}
      >
        Open sequence file(s)
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
          onClose={async (conf: unknown) => {
            if (conf) {
              // note this can throw before dialog closes, but this is handled
              // by the dialog itself
              const path = await ipcRenderer.invoke(
                'createInitialAutosaveFile',
                {
                  assemblies: conf,
                  defaultSession: {
                    name: `New Session ${new Date().toLocaleString('en-US')}`,
                  },
                },
              )
              setPluginManager(await loadPluginManager(path))
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
