import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { getSession } from '@jbrowse/core/util'
import { FileLocation, isSessionWithShareURL } from '@jbrowse/core/util/types'
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
  Tooltip,
} from '@mui/material'
import { openLocation } from '@jbrowse/core/util/io'
import { Dialog } from '@jbrowse/core/ui'
import AssemblySelector from '@jbrowse/core/ui/AssemblySelector'
import { makeStyles } from 'tss-react/mui'

// icons
import ImportIcon from '@mui/icons-material/Publish'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import HelpIcon from '@mui/icons-material/Help'

// locals
import { GridBookmarkModel } from '../../model'
import { fromUrlSafeB64 } from '../../utils'
import { readSessionFromDynamo } from '../../sessionSharing'

const useStyles = makeStyles()(theme => ({
  flexItem: {
    margin: 5,
  },
  expandIcon: {
    color: theme.palette.tertiary?.contrastText || '#fff',
  },
}))

async function getBookmarksFromShareLink(shareLink: string, shareURL: string) {
  const defaultURL = 'https://share.jbrowse.org/api/v1/'
  const urlParams = new URL(shareLink)
  const sessionQueryParam = urlParams.searchParams.get('bookmarks')
  const password = urlParams.searchParams.get('password')
  const decryptedSession = await readSessionFromDynamo(
    `${shareURL ?? defaultURL}load`,
    sessionQueryParam || '',
    password || '',
  )

  const sharedSession = JSON.parse(await fromUrlSafeB64(decryptedSession))

  return sharedSession.sharedBookmarks
}

async function getBookmarksFromFile(
  location: FileLocation,
  selectedAsm: string,
) {
  const data = await openLocation(location).readFile('utf8')
  return data
    .split(/\n|\r\n|\r/)
    .filter(f => !!f.trim())
    .filter(
      f =>
        !f.startsWith('#') &&
        !f.startsWith('track') &&
        !f.startsWith('browser'),
    )
    .map(line => {
      const [refName, start, end, label, assembly] = line.split('\t')
      return {
        assemblyName: assembly ?? selectedAsm,
        refName,
        start: +start,
        end: +end,
        label: label === '.' ? undefined : label,
      }
    })
}

const ImportBookmarksDialog = observer(function ({
  onClose,
  model,
}: {
  onClose: () => void
  model: GridBookmarkModel
}) {
  const { classes } = useStyles()
  const [location, setLocation] = useState<FileLocation>()
  const [error, setError] = useState<unknown>()
  const [shareLink, setShareLink] = useState('')
  const session = getSession(model)
  const { assemblyNames } = session
  const [selectedAsm, setSelectedAsm] = useState(assemblyNames[0])
  const [expanded, setExpanded] = useState('shareLinkAccordion')

  return (
    <Dialog open onClose={onClose} maxWidth="xl" title="Import bookmarks">
      <DialogContent>
        <Accordion
          expanded={expanded === 'shareLinkAccordion'}
          onChange={() => setExpanded('shareLinkAccordion')}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon className={classes.expandIcon} />}
          >
            <Typography
              style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              Import from share link{' '}
              <Tooltip title="The appropriate share link for sharing bookmarks is one generated via the 'Share' button in the 'Bookmarked regions' drawer. Paste it below to import shared bookmarks.">
                <HelpIcon />
              </Tooltip>
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TextField
              label="Enter URL"
              variant="outlined"
              style={{ width: '100%' }}
              value={shareLink}
              onChange={e => setShareLink(e.target.value)}
            />
          </AccordionDetails>
        </Accordion>
        <Accordion
          expanded={expanded === 'fileAccordion'}
          onChange={() => setExpanded('fileAccordion')}
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
        <Button variant="contained" color="secondary" onClick={onClose}>
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
              if (location) {
                model.importBookmarks(
                  await getBookmarksFromFile(location, selectedAsm),
                )
              } else if (shareLink && isSessionWithShareURL(session)) {
                model.importBookmarks(
                  await getBookmarksFromShareLink(shareLink, session.shareURL),
                )
              }
              onClose()
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
  )
})
export default ImportBookmarksDialog
