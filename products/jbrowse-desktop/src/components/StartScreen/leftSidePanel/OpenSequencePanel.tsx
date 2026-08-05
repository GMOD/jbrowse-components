import { Suspense, lazy, useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button } from '@mui/material'

import { newSessionName } from '../sessionName.ts'

import type { Fav, JBrowseConfig, LaunchCallback } from '../types.ts'
import type { AssemblyConf } from '@jbrowse/core/util/assemblyConfigUtils'

const useStyles = makeStyles()({
  button: {
    margin: 5,
    display: 'block',
  },
})

// Two dialogs behind two buttons, and between them most of what the left panel
// could pull in: the available-genomes table is ~2400 lines of grid, search
// index and category state, and the sequence dialog brings AddGenomePane and the
// assembly-config builders. Neither is on the way to anything the start screen
// shows by itself.
const OpenSequenceDialog = lazy(() => import('../../OpenSequenceDialog.tsx'))
const AvailableGenomesDialog = lazy(
  () => import('../availableGenomes/AvailableGenomesDialog.tsx'),
)

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
  const [availableGenomesDialogOpen, setAvailableGenomesDialogOpen] =
    useState(false)

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
          setAvailableGenomesDialogOpen(true)
        }}
      >
        Show all available genomes
      </Button>

      {/* no fallback: the chunk is on local disk, and a spinner sitting where
          the dialog is about to be reads as a broken button */}
      <Suspense fallback={null}>
        {sequenceDialogOpen ? (
          <OpenSequenceDialog
            onClose={async (conf?: AssemblyConf[]) => {
              if (conf) {
                launchFromSnap({
                  assemblies: conf,
                  tracks: [],
                  internetAccounts: [],
                  defaultSession: {
                    name: newSessionName(),
                  },
                })
              }
              setSequenceDialogOpen(false)
            }}
          />
        ) : null}

        {availableGenomesDialogOpen ? (
          <AvailableGenomesDialog
            favorites={favorites}
            setFavorites={setFavorites}
            launch={launch}
            onClose={() => {
              setAvailableGenomesDialogOpen(false)
            }}
          />
        ) : null}
      </Suspense>
    </div>
  )
}
