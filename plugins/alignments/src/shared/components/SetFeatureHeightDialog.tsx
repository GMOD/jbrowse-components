import { useState } from 'react'

import { SubmitDialog } from '@jbrowse/core/ui'
import {
  Checkbox,
  FormControlLabel,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

const SetFeatureHeightDialog = observer(function SetFeatureHeightDialog(props: {
  model: {
    setFeatureHeight: (arg?: number) => void
    setNoSpacing: (arg?: boolean) => void
    featureHeightSetting: number
    noSpacingSetting?: boolean
  }
  handleClose: () => void
}) {
  const { model, handleClose } = props
  const { featureHeightSetting, noSpacingSetting } = model
  const [height, setHeight] = useState(`${featureHeightSetting}`)
  const [noSpacing, setNoSpacing] = useState(noSpacingSetting)

  const ok = height !== '' && !Number.isNaN(+height)

  return (
    <SubmitDialog
      open
      title="Set feature height"
      submitDisabled={!ok}
      onCancel={handleClose}
      onSubmit={() => {
        model.setFeatureHeight(
          height !== '' && !Number.isNaN(+height) ? +height : undefined,
        )
        model.setNoSpacing(noSpacing)
        handleClose()
      }}
    >
      <Typography>
        Adjust the feature height and whether there is any spacing between
        features. Setting feature height to 1 and removing spacing makes the
        display very compact.
      </Typography>
      <TextField
        value={height}
        label="Feature height (px)"
        autoFocus
        onChange={event => {
          setHeight(event.target.value)
        }}
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={!!noSpacing}
            onChange={() => {
              setNoSpacing(val => !val)
            }}
          />
        }
        label="Remove spacing between features in y-direction?"
      />
    </SubmitDialog>
  )
})

export default SetFeatureHeightDialog
