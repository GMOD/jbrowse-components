import React from 'react'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'

// jbrowse core
import { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'

// locals
import TrackLabel from './TrackLabel'
import { LinearGenomeViewModel } from '..'

const useStyles = makeStyles()({
  trackLabel: {
    zIndex: 3,
  },
  trackLabelOffset: {
    position: 'relative',
    display: 'inline-block',
  },
  trackLabelOverlap: {
    position: 'absolute',
  },
})

type LGV = LinearGenomeViewModel

export default observer(function ({
  model,
  view,
}: {
  model: BaseTrackModel
  view: LGV
}) {
  const { classes, cx } = useStyles()
  const display = model.displays[0]
  const { trackLabel, trackLabelOverlap, trackLabelOffset } = classes
  const labelStyle =
    view.trackLabels !== 'overlapping' || display.prefersOffset
      ? trackLabelOffset
      : trackLabelOverlap

  return view.trackLabels !== 'hidden' ? (
    <TrackLabel track={model} className={cx(trackLabel, labelStyle)} />
  ) : null
})
