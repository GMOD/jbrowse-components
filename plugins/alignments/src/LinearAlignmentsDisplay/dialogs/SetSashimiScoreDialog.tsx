import { useState } from 'react'

import { NumberTextField, SubmitDialog } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

const SetSashimiScoreDialog = observer(function SetSashimiScoreDialog(props: {
  model: {
    minSashimiScore: number
    setMinSashimiScore: (arg: number) => void
  }
  handleClose: () => void
}) {
  const { model, handleClose } = props
  const [score, setScore] = useState<number | undefined>(model.minSashimiScore)
  const ok = score !== undefined

  return (
    <SubmitDialog
      open
      title="Filter sashimi arcs by score"
      submitDisabled={!ok}
      onCancel={handleClose}
      onSubmit={() => {
        if (score !== undefined) {
          model.setMinSashimiScore(score)
        }
        handleClose()
      }}
    >
      <Typography>
        Hide sashimi junction arcs with fewer than this many supporting reads.
        Set to 0 to show all arcs.
      </Typography>
      <NumberTextField
        defaultValue={model.minSashimiScore}
        onValueChange={setScore}
        label="Minimum read support"
        autoFocus
        min={0}
        errorText="Must be a non-negative number"
      />
    </SubmitDialog>
  )
})

export default SetSashimiScoreDialog
