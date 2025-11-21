import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import TrackLabel from './TrackLabel'

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

const TrackLabelContainer = observer(function ({
  track,
  view,
}: {
  track: BaseTrackModel
  view: LGV
}) {
  const { classes, cx } = useStyles()
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
