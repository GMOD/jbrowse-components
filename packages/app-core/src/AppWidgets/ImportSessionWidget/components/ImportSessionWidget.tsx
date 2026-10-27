import { useState } from 'react'

import { FileDropZone } from '@jbrowse/core/ui'
import { getEnv, getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, Paper, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { parseSessionFile } from '../parseSessionFile.ts'
import ImportError from './ImportError.tsx'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

const MAX_FILE_SIZE = 512 * 1024 ** 2 // 512 MiB

const useStyles = makeStyles()(theme => ({
  paper: {
    margin: theme.spacing(1),
    padding: theme.spacing(1),
  },
}))

const ImportSessionWidget = observer(function ImportSessionWidget({
  model,
}: {
  model: IAnyStateTreeNode
}) {
  const [error, setError] = useState<unknown>()
  const { classes } = useStyles()

  return (
    <>
      <Paper className={classes.paper}>
        <FileDropZone
          accept={{ 'application/json': ['.json'] }}
          maxSize={MAX_FILE_SIZE}
          multiple={false}
          message="Drag and drop a session file here"
          onDrop={async (acceptedFiles, rejectedFiles) => {
            try {
              setError(undefined)
              if (rejectedFiles.length > 0) {
                throw new Error(
                  rejectedFiles[0]!.errors.map(e => e.message).join(', '),
                )
              }
              const session = parseSessionFile(await acceptedFiles[0]!.text())
              await getEnv(model).pluginManager.preloadSessionTypes(session)
              getSession(model).setSession?.(session)
            } catch (e) {
              console.error(e)
              setError(e)
            }
          }}
        >
          <Typography color="text.secondary" align="center" variant="body2">
            or
          </Typography>
          <Button color="primary" variant="contained">
            Browse Files
          </Button>
        </FileDropZone>
      </Paper>
      {error ? <ImportError error={error} /> : null}
    </>
  )
})

export default ImportSessionWidget
