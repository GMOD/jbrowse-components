import React, { Component } from 'react'
import { PropTypes } from 'mobx-react'

import TrackBlocks from '../../LinearGenomeView/components/TrackBlocks'

import './AlignmentsTrack.scss'

export default function AlignmentsTrack(props) {
  const { blockState } = props.model
  return (
    <div className="AlignmentsTrack">
      <TrackBlocks {...props} blockState={blockState} />
    </div>
  )
}

AlignmentsTrack.propTypes = {
  model: PropTypes.observableObject.isRequired,
}
