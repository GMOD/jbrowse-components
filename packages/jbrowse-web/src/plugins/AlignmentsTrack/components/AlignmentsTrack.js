import React, { Component } from 'react'
import { observer, PropTypes } from 'mobx-react'

import TrackBlocks from '../../LinearGenomeView/components/TrackBlocks'

import ServerSideRenderedBlockContent from './ServerSideRenderedBlockContent'

import './AlignmentsTrack.scss'

export const AlignmentsTrackBlock = ServerSideRenderedBlockContent

const AlignmentsTrack = observer(props => {
  const { blockState } = props.model
  return (
    <div className="AlignmentsTrack">
      <TrackBlocks {...props} blockState={blockState} />
    </div>
  )
})

AlignmentsTrack.propTypes = {
  model: PropTypes.observableObject.isRequired,
}

export default AlignmentsTrack
