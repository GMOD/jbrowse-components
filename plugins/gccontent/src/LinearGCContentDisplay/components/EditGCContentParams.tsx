import { useState } from 'react'

import { ErrorBanner, NumberTextField, SubmitDialog } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

const EditGCContentParamsDialog = observer(function EditGCContentParamsDialog({
  model,
  handleClose,
}: {
  model: {
    windowSize: number
    windowDelta: number
    setGCContentParams: (a: { windowSize: number; windowDelta: number }) => void
  }
  handleClose: () => void
}) {
  const [windowSize, setWindowSize] = useState<number | undefined>(
    model.windowSize,
  )
  const [windowDelta, setWindowDelta] = useState<number | undefined>(
    model.windowDelta,
  )
  const stepLargerThanWindow =
    windowDelta !== undefined &&
    windowSize !== undefined &&
    windowDelta > windowSize

  return (
    <SubmitDialog
      open
      title="Edit GC content params"
      onCancel={handleClose}
      submitDisabled={
        windowSize === undefined ||
        windowDelta === undefined ||
        stepLargerThanWindow
      }
      onSubmit={() => {
        if (windowSize !== undefined && windowDelta !== undefined) {
          model.setGCContentParams({ windowSize, windowDelta })
          handleClose()
        }
      }}
    >
      <Typography>
        GC content is calculated in a particular sliding window of size N, and
        then the sliding window moves (steps) some number of bases M forward.
        Note that small step sizes can result in high CPU over large areas, and
        it is not recommended to make the step size larger than the window size
        as then the sliding window will miss contents.
      </Typography>
      {stepLargerThanWindow ? (
        <ErrorBanner error="It is not recommended to make the step size larger than the window size" />
      ) : null}
      <NumberTextField
        defaultValue={model.windowSize}
        label="Size of sliding window (bp)"
        onValueChange={setWindowSize}
      />
      <NumberTextField
        defaultValue={model.windowDelta}
        label="Step size of sliding window (bp)"
        onValueChange={setWindowDelta}
      />
    </SubmitDialog>
  )
})

export default EditGCContentParamsDialog
