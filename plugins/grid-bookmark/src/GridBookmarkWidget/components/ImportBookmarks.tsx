import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { getSession } from '@jbrowse/core/util'
import AssemblySelector from '@jbrowse/core/ui/AssemblySelector'
import { FileLocation } from '@jbrowse/core/util/types'
import { FileSelector } from '@jbrowse/core/ui'
import { openLocation } from '@jbrowse/core/util/io'
import {
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  makeStyles,
  Typography,
} from '@material-ui/core'
import CloseIcon from '@material-ui/icons/Close'
import ImportIcon from '@material-ui/icons/Publish'
import { GridBookmarkModel } from '../model'

const useStyles = makeStyles(() => ({
  closeDialog: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  dialogContainer: {
    margin: 15,
  },
  flexItem: {
    margin: 5,
  },
}))

function ImportBookmarks({
  model,
  assemblyName,
}: {
  model: GridBookmarkModel
  assemblyName: string
}) {
  const classes = useStyles()
  const session = getSession(model)
  const { assemblyNames } = session
  const [dialogOpen, setDialogOpen] = useState(false)
  const [location, setLocation] = useState<FileLocation>()
  const [error, setError] = useState<unknown>()
  const [selectedAsm, setSelectedAsm] = useState(
    assemblyName || assemblyNames[0],
  )

  return (
    <>
      <Button startIcon={<ImportIcon />} onClick={() => setDialogOpen(true)}>
        Import
      </Button>
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="xl"
      >
        <DialogTitle>
          Import bookmarks
          <IconButton
            className={classes.closeDialog}
            aria-label="close-dialog"
            onClick={() => setDialogOpen(false)}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography>
            Choose a BED format file to import. The first 4 columns will be used
          </Typography>

          <FileSelector
            location={location}
            setLocation={setLocation}
            name="File"
          />
          <Typography>Select assembly that your data belongs to</Typography>
          <AssemblySelector
            onChange={val => setSelectedAsm(val)}
            session={session}
            selected={selectedAsm}
          />
          {error ? (
            <Typography color="error" variant="h6">{`${error}`}</Typography>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => setDialogOpen(false)}
          >
            Cancel
          </Button>
          <Button
            className={classes.flexItem}
            data-testid="dialogImport"
            variant="contained"
            color="primary"
            disabled={!location}
            startIcon={<ImportIcon />}
            onClick={async () => {
              try {
                if (!location) {
                  return
                }
                const data = (await openLocation(location).readFile(
                  'utf8',
                )) as string
                const regions = data
                  .split('\n')
                  .filter(f => !!f.trim())
                  .filter(
                    f =>
                      !f.startsWith('#') &&
                      !f.startsWith('track') &&
                      !f.startsWith('browser'),
                  )
                  .map(line => {
                    const [refName, start, end, name] = line.split('\t')
                    return {
                      assemblyName: selectedAsm,
                      refName,
                      start: +start,
                      end: +end,
                      label: name === '.' ? undefined : name,
                    }
                  })
                model.importBookmarks(regions)
                setDialogOpen(false)
              } catch (e) {
                console.error(e)
                setError(e)
              }
            }}
          >
            Import
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default observer(ImportBookmarks)
