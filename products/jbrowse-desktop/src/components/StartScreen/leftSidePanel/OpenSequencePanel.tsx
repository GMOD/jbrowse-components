import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button } from '@mui/material'
import { observer } from 'mobx-react'

import { useStartScreenLaunch } from '../startScreenLaunch.ts'

const useStyles = makeStyles()({
  button: {
    margin: 5,
    display: 'block',
  },
})

const OpenSequencePanel = observer(function OpenSequencePanel() {
  const { classes } = useStyles()
  const { openDialog } = useStartScreenLaunch()

  return (
    <div>
      <Button
        variant="contained"
        color="primary"
        className={classes.button}
        onClick={() => {
          openDialog('openGenome')
        }}
      >
        Open your own genome
      </Button>
      <Button
        variant="contained"
        className={classes.button}
        onClick={() => {
          openDialog('hostedGenomes')
        }}
      >
        Browse hosted genomes
      </Button>
    </div>
  )
})

export default OpenSequencePanel
