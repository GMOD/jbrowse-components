import { useState } from 'react'

import { SubmitDialog } from '@jbrowse/core/ui'
import { TextField, Typography } from '@mui/material'
import { observer } from 'mobx-react'

function parsePx(value: string) {
  if (value === '') {
    return { valid: false, num: undefined as number | undefined }
  }
  const num = Number(value)
  return {
    valid: Number.isFinite(num) && num >= 0,
    num,
  }
}

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
  const { featureHeightSetting, featureSpacing } = model
  const [height, setHeight] = useState(`${featureHeightSetting}`)
  const [spacing, setSpacing] = useState(`${featureSpacing}`)

  const heightParsed = parsePx(height)
  const spacingParsed = parsePx(spacing)
  const ok = heightParsed.valid && spacingParsed.valid

  return (
    <SubmitDialog
      open
      title="Set feature height"
      submitDisabled={!ok}
      onCancel={handleClose}
      onSubmit={() => {
        model.setFeatureHeight(heightParsed.num)
        model.setFeatureSpacing(spacingParsed.num)
        handleClose()
      }}
    >
      <Typography>
        Adjust the feature height and the spacing between features. Setting
        feature height to 1 and spacing to 0 makes the display very compact.
      </Typography>
      <TextField
        value={height}
        label="Feature height (px)"
        autoFocus
        error={height !== '' && !heightParsed.valid}
        helperText={
          height !== '' && !heightParsed.valid
            ? 'Must be a non-negative number'
            : ''
        }
        onChange={event => {
          setHeight(event.target.value)
        }}
      />
      <TextField
        value={spacing}
        label="Feature spacing (px)"
        error={spacing !== '' && !spacingParsed.valid}
        helperText={
          spacing !== '' && !spacingParsed.valid
            ? 'Must be a non-negative number'
            : ''
        }
        onChange={event => {
          setSpacing(event.target.value)
        }}
      />
    </SubmitDialog>
  )
})

export default SetFeatureHeightDialog
