import React, { useState, useEffect } from 'react'
import { observer } from 'mobx-react'
import Button from '@material-ui/core/Button'
import { makeStyles } from '@material-ui/core/styles'
import { LinearGenomeViewModel } from '..'
import Search from '@material-ui/icons/Search'
import { fade } from '@material-ui/core/styles/colorManipulator'

const WIDGET_HEIGHT = 32
const SPACING = 7

const useStyles = makeStyles(theme => ({
  sequenceSearchButton: {
    background: fade(theme.palette.background.paper, 0.8),
    height: WIDGET_HEIGHT,
    margin: SPACING,
  },
}))

function SequenceSearchButton({ model }: { model: LinearGenomeViewModel }) {
  const classes = useStyles()
  return (
    <>
      <Button
        variant="outlined"
        className={classes.sequenceSearchButton}
        onClick={model.activateTrackSelector}
      >
        <Search />
      </Button>
    </>
  )
}

export default observer(SequenceSearchButton)
