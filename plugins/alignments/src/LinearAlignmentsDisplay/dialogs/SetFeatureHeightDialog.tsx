import { useState } from 'react'

import { NumberTextField, SubmitDialog } from '@jbrowse/core/ui'
import { capitalizeFirst } from '@jbrowse/core/util'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

const SetFeatureHeightDialog = observer(function SetFeatureHeightDialog(props: {
  model: {
    setFeatureHeight: (arg?: number) => void
    configuredFeatureHeight: number
  }
  // What this display draws one of — 'read' here, 'feature' on
  // LGVSyntenyDisplay, which reuses the whole menu. The menu row already carries
  // it, so the dialog it opens has to as well or the two disagree on screen.
  noun: string
  handleClose: () => void
}) {
  const { model, noun, handleClose } = props
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
      title={`Custom ${noun} height`}
      submitDisabled={!ok}
      onCancel={handleClose}
      onSubmit={() => {
        model.setFeatureHeight(height)
        handleClose()
      }}
    >
      <Typography>
        Adjust the {noun} height. The spacing between {noun}s is derived from it
        — a 1px gap once {noun}s are tall enough, otherwise flush. Setting the
        height to 1 makes the display very compact.
      </Typography>
      <NumberTextField
        defaultValue={model.configuredFeatureHeight}
        onValueChange={setHeight}
        label={`${capitalizeFirst(noun)} height (px)`}
        autoFocus
        min={1}
        errorText="Must be at least 1px"
      />
    </SubmitDialog>
  )
})

export default SetFeatureHeightDialog
