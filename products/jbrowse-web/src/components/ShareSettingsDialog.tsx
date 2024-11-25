import React, { useState } from 'react'
import { Dialog } from '@jbrowse/core/ui'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import {
  DialogContent,
  DialogContentText,
  IconButton,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
} from '@mui/material'

// icons
import InfoDialog from './ShareInfoDialog'

const SHARE_URL_LOCALSTORAGE_KEY = 'jbrowse-shareURL'

export default function SettingsDialog(props: {
  open: boolean
  onClose: (arg?: string) => void
  currentSetting: string
}) {
  const { onClose, open, currentSetting } = props
  const [setting, setSetting] = useState(currentSetting)
  const [infoDialogOpen, setInfoDialogOpen] = useState(false)

  const handleClose = () => {
    localStorage.setItem(SHARE_URL_LOCALSTORAGE_KEY, setting)
    onClose(setting)
  }

  return (
    <>
      <Dialog
        onClose={handleClose}
        open={open}
        title="Configure session sharing"
      >
        <DialogContent>
          <DialogContentText>
            Select between generating long or short URLs for the session sharing
            <IconButton
              onClick={() => {
                setInfoDialogOpen(true)
              }}
            >
              <HelpOutlineIcon />
            </IconButton>
          </DialogContentText>
          <FormControl component="fieldset">
            <RadioGroup
              value={setting}
              onChange={event => {
                setSetting(event.target.value)
              }}
            >
              <FormControlLabel
                value="short"
                control={<Radio />}
                label="Short URL"
              />
              <FormControlLabel
                value="long"
                control={<Radio />}
                label="Long URL"
              />
            </RadioGroup>
          </FormControl>
        </DialogContent>
      </Dialog>
      <InfoDialog
        open={infoDialogOpen}
        onClose={() => {
          setInfoDialogOpen(false)
        }}
      />
    </>
  )
}
