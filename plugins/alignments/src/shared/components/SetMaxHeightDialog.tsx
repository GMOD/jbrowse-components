import { useState } from 'react'

import { NumberTextField, SubmitDialog } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

const useStyles = makeStyles()({
  root: {
    width: 500,
  },
})

const SetMaxHeightDialog = observer(function SetMaxHeightDialog(props: {
  model: {
    maxHeight?: number
    setMaxHeight: (arg?: number) => void
  }
  handleClose: () => void
}) {
  const { model, handleClose } = props
  const { classes } = useStyles()
  const [max, setMax] = useState<number | undefined>(model.maxHeight)

  return (
    <SubmitDialog
      open
      title="Set max track height"
      onCancel={handleClose}
      onSubmit={() => {
        model.setMaxHeight(max)
        handleClose()
      }}
    >
      <div className={classes.root}>
        <Typography>
          Set max layout height for the track. For example, you can increase
          this if the layout says &quot;Max height reached&quot;
        </Typography>
        <NumberTextField
          defaultValue={model.maxHeight}
          onValueChange={setMax}
          label="Max height (px)"
          autoFocus
          min={1}
          errorText="Must be a positive number"
        />
      </div>
    </SubmitDialog>
  )
})
export default SetMaxHeightDialog
