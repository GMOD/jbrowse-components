import { makeStyles } from '@jbrowse/core/util/tss-react'
import { ConfigurationEditor } from '@jbrowse/plugin-config'
import { Button, DialogActions, DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const useStyles = makeStyles()({
  container: {
    overflow: 'auto',
    maxHeight: 600,
  },
})
const AssemblyEditor = observer(function AssemblyEditor({
  assembly,
  onClose,
}: {
  assembly?: AnyConfigurationModel
  onClose: () => void
}) {
  const { classes } = useStyles()
  return (
    <>
      <DialogContent>
        <div className={classes.container}>
          {assembly ? (
            <ConfigurationEditor model={{ target: assembly }} />
          ) : (
            <div>No assembly</div>
          )}
        </div>
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          onClick={() => {
            onClose()
          }}
        >
          Back
        </Button>
      </DialogActions>
    </>
  )
})

export default AssemblyEditor
