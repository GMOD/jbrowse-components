import React from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import Header from './Header'
import LinearComparativeRenderArea from './LinearComparativeRenderArea'
import Rubberband from './Rubberband'
import type { LinearComparativeViewModel } from '../model'

const useStyles = makeStyles()(theme => ({
  // this helps keep the vertical guide inside the parent view container,
  // similar style exists in the single LGV's trackscontainer
  rubberbandContainer: {
    position: 'relative',
    overflow: 'hidden',
  },

  rubberbandDiv: {
    width: '100%',
    background: theme.palette.action.disabledBackground,
    height: 15,
    '&:hover': {
      background: theme.palette.action.selected,
    },
  },
}))

const LinearComparativeView = observer(function ({
  model,
}: {
  model: LinearComparativeViewModel
}) {
  const { classes } = useStyles()

  return (
    <div className={classes.rubberbandContainer}>
      <Header model={model} />
      <Rubberband
        model={model}
        ControlComponent={<div className={classes.rubberbandDiv} />}
      />
      <LinearComparativeRenderArea model={model} />
    </div>
  )
})

export default LinearComparativeView
