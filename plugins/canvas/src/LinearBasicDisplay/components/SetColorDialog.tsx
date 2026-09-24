import { SubmitDialog } from '@jbrowse/core/ui'
import ColorPicker from '@jbrowse/core/ui/ColorPicker'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

// The UTR picker shows only on a display that has a `utrColor` slot.
const SetColorDialog = observer(function SetColorDialog({
  model,
  handleClose,
}: {
  model: {
    featureColor: string
    colorSettings: { value?: string }
    setFeatureColor: (arg?: string) => void
    utrColor?: string
    setUtrColor?: (arg?: string) => void
  }
  handleClose: () => void
}) {
  const { value } = model.colorSettings
  const { utrColor, setUtrColor } = model
  return (
    <SubmitDialog
      open
      title="Set colors"
      submitText="Close"
      onCancel={handleClose}
      onSubmit={handleClose}
      onReset={() => {
        model.setFeatureColor(undefined)
        setUtrColor?.(undefined)
      }}
    >
      <Typography>Feature color</Typography>
      {value !== undefined && isJexl(value) ? (
        <Typography variant="body2" color="textSecondary">
          Picking a color replaces the track&apos;s expression{' '}
          <code>{value}</code>
        </Typography>
      ) : null}
      <ColorPicker
        color={model.featureColor}
        onChange={color => {
          model.setFeatureColor(color)
        }}
      />
      {utrColor !== undefined && setUtrColor ? (
        <>
          <Typography>UTR color (gene/transcript UTRs)</Typography>
          <ColorPicker
            color={utrColor}
            onChange={color => {
              setUtrColor(color)
            }}
          />
        </>
      ) : null}
    </SubmitDialog>
  )
})

export default SetColorDialog
