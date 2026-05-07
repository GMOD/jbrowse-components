import { useState } from 'react'

import { SubmitDialog } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { TextField, Typography } from '@mui/material'
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
  const { maxHeight = '' } = model
  const [max, setMax] = useState(`${maxHeight}`)

  return (
    <SubmitDialog
      open
      title="Set max track height"
      onCancel={handleClose}
      onSubmit={() => {
        model.setMaxHeight(max !== '' && !Number.isNaN(+max) ? +max : undefined)
        handleClose()
      }}
    >
      <div className={classes.root}>
        <Typography>
          Set max layout height for the track. For example, you can increase
          this if the layout says &quot;Max height reached&quot;
        </Typography>
        <TextField
          value={max}
          autoFocus
          onChange={event => {
            setMax(event.target.value)
          }}
          label="Max height (px)"
        />
      </div>
    </SubmitDialog>
  )
})
export default SetMaxHeightDialog
