import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { getSession } from '@jbrowse/core/util'
import AssemblySelector from '@jbrowse/core/ui/AssemblySelector'
import { FileLocation } from '@jbrowse/core/util/types'
import { FileSelector } from '@jbrowse/core/ui'
import { openLocation } from '@jbrowse/core/util/io'
import {
  Button,
  DialogContent,
  DialogActions,
  Typography,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'
import { Dialog } from '@jbrowse/core/ui'
import { makeStyles } from 'tss-react/mui'

// icons
import ImportIcon from '@mui/icons-material/Publish'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

// locals
import { GridBookmarkModel } from '../model'

const useStyles = makeStyles()(theme => ({
  dialogContainer: {
    margin: 15,
  },
  flexItem: {
    margin: 5,
  },
  expandIcon: {
    color: theme.palette.tertiary?.contrastText || '#fff',
  },
}))

function ImportBookmarks({ model }: { model: GridBookmarkModel }) {
  const { classes } = useStyles()
  const session = getSession(model)
  const { assemblyNames } = session
  const [dialogOpen, setDialogOpen] = useState(false)
  const [location, setLocation] = useState<FileLocation>()
  const [error, setError] = useState<unknown>()
  // TODO: assemblies
  const [selectedAsm, setSelectedAsm] = useState(assemblyNames[0])
  const [shareLink, setShareLink] = useState('')

  const [expanded, setExpanded] = React.useState<string | false>(
    'shareLinkAccordion',
  )

  const handleChange =
    (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
      setExpanded(isExpanded ? panel : false)
    }

  // TODO: possible UI here; accordion options?
  return (
    <>
      <Button startIcon={<ImportIcon />} onClick={() => setDialogOpen(true)}>
        Import
      </Button>
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="xl"
        title="Import bookmarks"
      >
        <DialogContent>
          <Accordion
            expanded={expanded === 'shareLinkAccordion'}
            onChange={handleChange('shareLinkAccordion')}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon className={classes.expandIcon} />}
            >
              <Typography>Import from share link</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <TextField
                label="Enter URL"
                variant="outlined"
                style={{ width: '100%' }}
                value={shareLink}
                onChange={e => {
                  setShareLink(e.target.value)
                }}
              />
            </AccordionDetails>
          </Accordion>
          <Accordion
            expanded={expanded === 'fileAccordion'}
            onChange={handleChange('fileAccordion')}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon className={classes.expandIcon} />}
            >
              <Typography>Import from file</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <FileSelector
                location={location}
                setLocation={setLocation}
                name="File"
                description="Choose a BED or TSV format file to import. The first 4 columns will be used."
              />
              {error ? (
                <Typography color="error" variant="h6">{`${error}`}</Typography>
              ) : null}
            </AccordionDetails>
          </Accordion>
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
            disabled={!location && !shareLink}
            startIcon={<ImportIcon />}
            onClick={async () => {
              // TODO: implement
              // clear field
              try {
                if (!location && !shareLink) {
                  return
                }
                if (location) {
                  // const regions = await handleLocation(location, selectedAsm)
                  // model.importBookmarks(regions)
                }
                if (shareLink) {
                  // const regions = await handleShareLink(shareLink, selectedAsm)
                  // model.importBookmarks(regions)
                }
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
