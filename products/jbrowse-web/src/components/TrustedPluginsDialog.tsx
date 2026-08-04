import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  DialogActions,
  DialogContent,
  Link,
  Typography,
} from '@mui/material'

import { forgetTrustedPlugins, listTrustedPlugins } from '../trustedPlugins.ts'

// The counterpart to PluginWarningDialog's "Remember on this site": without it a
// trust decision made once on an origin was permanent, with no way to see what
// had been approved or take it back.
//
// Revocation is all-or-nothing because the grant is: checkPlugins triages a
// config or session only when *every* plugin it names is already trusted, so
// dropping one URL re-prompts for the whole set anyway. A per-row forget would
// offer a finer control than the thing it controls actually has.
export default function TrustedPluginsDialog({
  onClose,
}: {
  onClose: () => void
}) {
  const [urls, setUrls] = useState(listTrustedPlugins)
  return (
    <Dialog open onClose={onClose} title="Trusted plugins" maxWidth="xl">
      <DialogContent style={{ width: 800 }}>
        {urls.length ? (
          <>
            <Typography>
              Plugins you approved from a cross-origin config or session on this
              site. They load without a warning until you forget them.
            </Typography>
            <ul>
              {urls.map(url => (
                <li key={url}>
                  <Link href={url} target="_blank" rel="noreferrer">
                    {url}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <Typography>
            No plugins are trusted on this site. A config or session that loads
            a plugin from another origin asks before running it.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        {urls.length ? (
          <Button
            variant="contained"
            color="secondary"
            onClick={() => {
              forgetTrustedPlugins()
              // stay open showing the empty state, so the click visibly did
              // something rather than just closing the dialog
              setUrls([])
            }}
          >
            Forget all
          </Button>
        ) : null}
        <Button
          variant="contained"
          onClick={() => {
            onClose()
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}
