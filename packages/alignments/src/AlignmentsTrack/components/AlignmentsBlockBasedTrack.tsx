import { getConf } from '@gmod/jbrowse-core/configuration'
import { makeStyles } from '@material-ui/core/styles'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React from 'react'
import AlignmentsTrackBlocks from './AlignmentsTrackBlocks'
import { AlignmentsTrackModel } from '../model'

const useStyles = makeStyles({
  track: {
    position: 'relative',
    whiteSpace: 'nowrap',
    textAlign: 'left',
    width: '100%',
    minHeight: '100%',
  },
})

function AlignmentsBlockBasedTrack(props: {
  model: AlignmentsTrackModel
  children: React.ReactNode
  showPileup: boolean
  showSNPCoverage: boolean
}) {
  const classes = useStyles()
  const { model, children, showPileup, showSNPCoverage } = props
  const { TrackMessageComponent } = model
  return (
    <div
      data-testid={`track-${getConf(model, 'trackId')}`}
      className={classes.track}
      role="presentation"
    >
      {TrackMessageComponent ? (
        <TrackMessageComponent model={model} />
      ) : (
        <AlignmentsTrackBlocks
          {...props}
          showPileup={showPileup}
          showSNPCoverage={showSNPCoverage}
        />
      )}
      {children}
    </div>
  )
}

AlignmentsBlockBasedTrack.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
  children: PropTypes.node,
  showPileup: PropTypes.bool.isRequired,
  showSNPCoverage: PropTypes.bool.isRequired,
}

AlignmentsBlockBasedTrack.defaultProps = {
  children: null,
}

export default observer(AlignmentsBlockBasedTrack)
