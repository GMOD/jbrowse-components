import React, { useState } from 'react'
import { Button, makeStyles } from '@material-ui/core'
import PluginManager from '@jbrowse/core/PluginManager'
import PreloadedDatasetSelector from './PreloadedDatasetSelector'
import OpenSequenceDialog from './OpenSequenceDialog'
import OpenJBrowseWebConfigDialog from './OpenJBrowseWebConfigDialog'

const useStyles = makeStyles(theme => ({
  formControl: {
    margin: theme.spacing(1),
    minWidth: 200,
  },
  button: {
    minWidth: 200,
    margin: theme.spacing(3),
    height: '3em',
  },
}))

export default function StartScreenOptionsPanel({
  setPluginManager,
}: {
  setPluginManager: (arg0: PluginManager) => void
}) {
  const classes = useStyles()
  const [sequenceDialogOpen, setSequenceDialogOpen] = useState(false)
  const [dataDirectoryDialogOpen, setDataDirectoryDialogOpen] = useState(false)
  return (
    <>
      <Button
        variant="contained"
        color="primary"
        className={classes.button}
        onClick={() => setSequenceDialogOpen(true)}
      >
        Open sequence file
      </Button>
      <Button
        variant="contained"
        color="primary"
        className={classes.button}
        onClick={() => setDataDirectoryDialogOpen(true)}
      >
        Open jbrowse web config
      </Button>
      <PreloadedDatasetSelector setPluginManager={setPluginManager} />
      {sequenceDialogOpen ? (
        <OpenSequenceDialog
          onClose={() => setSequenceDialogOpen(false)}
          setPluginManager={setPluginManager}
        />
      ) : null}
      {dataDirectoryDialogOpen ? (
        <OpenJBrowseWebConfigDialog
          onClose={() => setDataDirectoryDialogOpen(false)}
          setPluginManager={setPluginManager}
        />
      ) : null}
    </>
  )
}
