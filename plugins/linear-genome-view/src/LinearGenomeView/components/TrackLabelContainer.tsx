import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import TrackLabel from './TrackLabel.tsx'

import type { LinearGenomeViewModel } from '..'
import type { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'

const useStyles = makeStyles()({
  trackLabel: {
    zIndex: 2,
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

const TrackLabelContainer = observer(function TrackLabelContainer({
  track,
  view,
}: {
  track: BaseTrackModel
  view: LGV
}) {
  const { classes } = useStyles()
  const display = track.displays[0]
  const labelStyle =
    view.trackLabelsSetting !== 'overlapping' || display.prefersOffset
      ? classes.trackLabelOffset
      : classes.trackLabelOverlap

  return view.trackLabelsSetting !== 'hidden' ? (
    <TrackLabel track={track} className={cx(classes.trackLabel, labelStyle)} />
  ) : null
})

export default TrackLabelContainer
