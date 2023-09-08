import React, { useState, useEffect } from 'react'
import { observer } from 'mobx-react'
import { getSession } from '@jbrowse/core/util'
import { FileLocation } from '@jbrowse/core/util/types'
import { FileSelector } from '@jbrowse/core/ui'
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
import { openLocation } from '@jbrowse/core/util/io'
import { Dialog } from '@jbrowse/core/ui'
import AssemblySelector from '@jbrowse/core/ui/AssemblySelector'
import { fromUrlSafeB64 } from '@jbrowse/web/src/util'
import { readSessionFromDynamo } from '@jbrowse/web/src/sessionSharing'
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
  const [dialogOpen, setDialogOpen] = useState(false)
  const [location, setLocation] = useState<FileLocation>()
  const [error, setError] = useState<unknown>()
  const [shareLink, setShareLink] = useState('')
  const session = getSession(model)
  const { assemblyNames } = session
  const [selectedAsm, setSelectedAsm] = useState(assemblyNames[0])

  const [expanded, setExpanded] = React.useState<string | false>(
    'shareLinkAccordion',
  )

  const handleShareLink = async () => {
    const defaultURL = 'https://share.jbrowse.org/api/v1/'
    const urlParams = new URL(shareLink)
    const sessionQueryParam = urlParams.searchParams.get('session')
    const password = urlParams.searchParams.get('password')
    const decryptedSession = await readSessionFromDynamo(
      `${session.shareURL ?? defaultURL}load`,
      sessionQueryParam || '',
      password || '',
    )

    const sharedSession = JSON.parse(await fromUrlSafeB64(decryptedSession))

    return sharedSession.sharedBookmarks
  }

  const handleChange =
    (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
      setExpanded(isExpanded ? panel : false)
    }

  useEffect(() => {
    setShareLink('')
    setError(undefined)
  }, [dialogOpen])

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
                description="Choose a BED or TSV format file to import."
              />
              <AssemblySelector
                onChange={val => setSelectedAsm(val)}
                helperText={`Select the assembly your bookmarks belong to (BED or TSV without assembly column).`}
                session={session}
                selected={selectedAsm}
              />
            </AccordionDetails>
          </Accordion>
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
            disabled={!location && !shareLink}
            startIcon={<ImportIcon />}
            onClick={async () => {
              try {
                let regions = undefined
                if (!location && !shareLink) {
                  return
                }
                if (location) {
                  const data = await openLocation(location).readFile('utf8')
                  regions = data
                    .split(/\n|\r\n|\r/)
                    .filter(f => !!f.trim())
                    .filter(
                      f =>
                        !f.startsWith('#') &&
                        !f.startsWith('track') &&
                        !f.startsWith('browser'),
                    )
                    .map(line => {
                      const [refName, start, end, label, assembly] =
                        line.split('\t')
                      return {
                        assemblyName: assembly ?? selectedAsm,
                        refName,
                        start: +start,
                        end: +end,
                        label: label === '.' ? undefined : label,
                      }
                    })
                }
                if (shareLink) {
                  regions = await handleShareLink()
                }
                if (regions) {
                  model.importBookmarks(regions)
                  setDialogOpen(false)
                }
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
