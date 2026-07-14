import { useState } from 'react'

import { NumberTextField, SubmitDialog } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

const SetFeatureHeightDialog = observer(function SetFeatureHeightDialog(props: {
  model: {
    setFeatureHeight: (arg?: number) => void
    configuredFeatureHeight: number
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
  const ok = height !== undefined

  return (
    <SubmitDialog
      open
      title="Custom read height"
      submitDisabled={!ok}
      onCancel={handleClose}
      onSubmit={() => {
        model.setFeatureHeight(height)
        handleClose()
      }}
    >
      <Typography>
        Adjust the feature height. The spacing between reads is derived from it
        — a 1px gap once reads are tall enough, otherwise flush. Setting the
        height to 1 makes the display very compact.
      </Typography>
      <NumberTextField
        defaultValue={model.configuredFeatureHeight}
        onValueChange={setHeight}
        label="Feature height (px)"
        autoFocus
        min={0}
        errorText="Must be a non-negative number"
      />
    </SubmitDialog>
  )
})

export default SetFeatureHeightDialog
