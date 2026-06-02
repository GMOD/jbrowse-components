import { Dialog } from '@jbrowse/core/ui'
import ColorPicker from '@jbrowse/core/ui/ColorPicker'
import { Button, DialogActions, DialogContent, Typography } from '@mui/material'
import { observer } from 'mobx-react'

// Simple solid-color picker for canvas feature displays. The headline "make
// this track blue" case sets color1; UTR color (color3) is exposed for
// gene/transcript tracks. Per-feature jexl coloring still lives in the config.
const SetColorDialog = observer(function SetColorDialog({
  model,
  handleClose,
}: {
  model: {
    featureColor: string
    utrColor: string
    setFeatureColor: (arg?: string) => void
    setUtrColor: (arg?: string) => void
  }
  handleClose: () => void
}) {
  return (
    <Dialog
      open
      onClose={() => {
        handleClose()
      }}
      title="Set colors"
    >
      <DialogContent>
        <Typography>Feature color</Typography>
        <ColorPicker
          color={model.featureColor}
          onChange={color => {
            model.setFeatureColor(color)
          }}
        />
        <Typography>UTR color (gene/transcript UTRs)</Typography>
        <ColorPicker
          color={model.utrColor}
          onChange={color => {
            model.setUtrColor(color)
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            model.setFeatureColor(undefined)
            model.setUtrColor(undefined)
          }}
          color="secondary"
          variant="contained"
        >
          Restore default
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            handleClose()
          }}
        >
          Submit
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default SetColorDialog
