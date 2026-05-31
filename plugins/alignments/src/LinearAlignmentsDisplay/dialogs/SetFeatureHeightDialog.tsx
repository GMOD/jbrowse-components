import { useState } from 'react'

import { NumberTextField, SubmitDialog } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

const SetFeatureHeightDialog = observer(function SetFeatureHeightDialog(props: {
  model: {
    setFeatureHeight: (arg?: number) => void
    setFeatureSpacing: (arg?: number) => void
    featureHeightSetting: number
    featureSpacing: number
  }
  handleClose: () => void
}) {
  const { model, handleClose } = props
  const [height, setHeight] = useState<number | undefined>(
    model.featureHeightSetting,
  )
  const [spacing, setSpacing] = useState<number | undefined>(
    model.featureSpacing,
  )
  const ok = height !== undefined && spacing !== undefined

  return (
    <SubmitDialog
      open
      title="Set feature height"
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
        defaultValue={model.featureHeightSetting}
        onValueChange={setHeight}
        label="Feature height (px)"
        autoFocus
        min={0}
        errorText="Must be a non-negative number"
      />
      <NumberTextField
        defaultValue={model.featureSpacing}
        onValueChange={setSpacing}
        label="Feature spacing (px)"
        min={0}
        errorText="Must be a non-negative number"
      />
    </SubmitDialog>
  )
})

export default SetFeatureHeightDialog
