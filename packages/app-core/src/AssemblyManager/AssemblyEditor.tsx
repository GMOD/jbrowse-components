import { getEnv } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, DialogActions, DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  container: {
    overflow: 'auto',
    maxHeight: 600,
  },
})
const AssemblyEditor = observer(function AssemblyEditor({
  session,
  assembly,
  onClose,
}: {
  session: AbstractSessionModel
  assembly: AnyConfigurationModel
  onClose: () => void
}) {
  const { classes } = useStyles()
  const ConfigurationEditor = getEnv(session).pluginManager.getWidgetType(
    'ConfigurationEditorWidget',
  ).ReactComponent
  return (
    <>
      <DialogContent>
        <div className={classes.container}>
          <ConfigurationEditor model={{ target: assembly }} />
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
