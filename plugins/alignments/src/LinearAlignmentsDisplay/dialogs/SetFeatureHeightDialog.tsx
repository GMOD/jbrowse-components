import { useState } from 'react'

import { NumberTextField, SubmitDialog } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

const SetFeatureHeightDialog = observer(function SetFeatureHeightDialog(props: {
  model: {
    setFeatureHeight: (arg?: number) => void
    setFeatureSpacing: (arg?: number) => void
    configuredFeatureHeight: number
    configuredFeatureSpacing: number
  }
  handleClose: () => void
}) {
  const { model, handleClose } = props
  // Seed from the configured (fixed-mode) size, not the resolved `featureHeight`
  // — in Compressed mode that resolves to the fractional fit pitch, so editing
  // would start from and bake the squeezed value.
  const [height, setHeight] = useState<number | undefined>(
    model.configuredFeatureHeight,
  )
  const [spacing, setSpacing] = useState<number | undefined>(
    model.configuredFeatureSpacing,
  )
  const ok = height !== undefined && spacing !== undefined

  return (
    <SubmitDialog
      open
      title="Custom read height"
      submitDisabled={!ok}
      onCancel={handleClose}
      onSubmit={() => {
        model.setFeatureHeight(height)
        model.setFeatureSpacing(spacing)
        handleClose()
      }}
    >
      <Typography>
        Adjust the feature height and the spacing between features. Setting
        feature height to 1 and spacing to 0 makes the display very compact.
      </Typography>
      <NumberTextField
        defaultValue={model.configuredFeatureHeight}
        onValueChange={setHeight}
        label="Feature height (px)"
        autoFocus
        min={0}
        errorText="Must be a non-negative number"
      />
      <NumberTextField
        defaultValue={model.configuredFeatureSpacing}
        onValueChange={setSpacing}
        label="Feature spacing (px)"
        min={0}
        errorText="Must be a non-negative number"
      />
    </SubmitDialog>
  )
})

export default SetFeatureHeightDialog
