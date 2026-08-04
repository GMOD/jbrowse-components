import { SubmitDialog } from '@jbrowse/core/ui'
import ColorPicker from '@jbrowse/core/ui/ColorPicker'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

// Simple solid-color picker for canvas feature displays. The headline "make
// this track blue" case sets `color`; UTR color is exposed for gene/transcript
// tracks. Per-feature jexl coloring still lives in the config.
const SetColorDialog = observer(function SetColorDialog({
  model,
  handleClose,
  showUtrColor = true,
}: {
  model: {
    featureColor: string
    utrColor: string
    setFeatureColor: (arg?: string) => void
    setUtrColor: (arg?: string) => void
  }
  handleClose: () => void
  showUtrColor?: boolean
}) {
  return (
    <SubmitDialog
      open
      title="Set colors"
      submitText="Close"
      onCancel={handleClose}
      onSubmit={handleClose}
      // Reset only what this dialog is showing. A display that hides the UTR
      // picker (variants — openSetColorDialog(false)) has no UTRs to color, so
      // clearing that slot here would silently undo a config-authored value
      // through a control the user can't see.
      onReset={() => {
        model.setFeatureColor(undefined)
        if (showUtrColor) {
          model.setUtrColor(undefined)
        }
      }}
    >
      <Typography>Feature color</Typography>
      <ColorPicker
        color={model.featureColor}
        onChange={color => {
          model.setFeatureColor(color)
        }}
      />
      {showUtrColor ? (
        <>
          <Typography>UTR color (gene/transcript UTRs)</Typography>
          <ColorPicker
            color={model.utrColor}
            onChange={color => {
              model.setUtrColor(color)
            }}
          />
        </>
      ) : null}
    </SubmitDialog>
  )
})

export default SetColorDialog
