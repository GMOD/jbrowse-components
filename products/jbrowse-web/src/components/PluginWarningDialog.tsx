import { useState } from 'react'

import { pluginDescriptionString, pluginUrl } from '@jbrowse/core/PluginLoader'
import { Dialog } from '@jbrowse/core/ui'
import {
  Alert,
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  FormControlLabel,
} from '@mui/material'

import type { PluginDefinition } from '@jbrowse/core/PluginLoader'

const text = {
  config: {
    intro:
      'This link contains a cross origin config that has the following unknown plugins:',
    trust: 'Please ensure you trust the source of this link.',
    details:
      'Config files can load arbitrary javascript files via plugins. For security purposes, we display this message when a cross-origin config is detected to be loading plugins that are not in our plugin store',
  },
  session: {
    intro:
      'This link contains a session that has the following unknown plugins:',
    trust: 'Please ensure you trust the source of this session.',
    details:
      'Sessions can load arbitrary javascript files via session plugins. For security purposes, we display this message when sessions contain plugins that are not from our plugin store',
  },
}

export default function PluginWarningDialog({
  kind,
  onConfirm,
  onCancel,
  reason,
}: {
  kind: 'config' | 'session'
  onConfirm: (remember: boolean) => void
  onCancel: () => void
  reason: PluginDefinition[]
}) {
  const [show, setShow] = useState(false)
  const [remember, setRemember] = useState(true)
  const { intro, trust, details } = text[kind]
  return (
    <Dialog
      open
      maxWidth="xl"
      title="Warning"
      onClose={() => {
        onCancel()
      }}
    >
      <DialogContent>
        <Alert severity="warning" style={{ width: 800 }}>
          {intro}
          <ul>
            {reason.map(r => (
              <li key={pluginUrl(r)}>
                {pluginDescriptionString(r)} - ({pluginUrl(r)})
              </li>
            ))}
          </ul>
          {trust}{' '}
          <Button
            variant="contained"
            type="button"
            size="small"
            onClick={() => {
              setShow(s => !s)
            }}
          >
            {show ? 'Hide details' : 'Why am I seeing this?'}
          </Button>
          {show ? <div>{details}</div> : null}
        </Alert>
      </DialogContent>
      <DialogActions>
        <FormControlLabel
          control={
            <Checkbox
              checked={remember}
              onChange={event => {
                setRemember(event.target.checked)
              }}
            />
          }
          label="Remember on this site"
        />
        <Button
          color="primary"
          variant="contained"
          onClick={() => {
            onConfirm(remember)
          }}
        >
          Yes, I trust it
        </Button>
        <Button
          color="secondary"
          variant="contained"
          onClick={() => {
            onCancel()
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}
