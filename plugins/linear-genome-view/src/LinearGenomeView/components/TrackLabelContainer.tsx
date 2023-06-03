import React from 'react'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'

// jbrowse core
import { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'

// locals
import { LinearGenomeViewModel } from '..'
import TrackLabel from './TrackLabel'

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

const TrackLabelContainer = observer(function ({
  track,
  view,
}: {
  track: BaseTrackModel
  view: LGV
}) {
  const { classes, cx } = useStyles()
  const display = track.displays[0]
  const { trackLabel, trackLabelOverlap, trackLabelOffset } = classes
  const labelStyle =
    view.trackLabels !== 'overlapping' || display.prefersOffset
      ? trackLabelOffset
      : trackLabelOverlap

  return view.trackLabels !== 'hidden' ? (
    <TrackLabel track={track} className={cx(trackLabel, labelStyle)} />
  ) : null
})

export default TrackLabelContainer
