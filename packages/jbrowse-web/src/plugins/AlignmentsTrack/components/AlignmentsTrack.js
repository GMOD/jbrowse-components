import React, { Component } from 'react'
import { PropTypes } from 'mobx-react'

import TrackBlocks from '../../LinearGenomeView/components/TrackBlocks'

import './AlignmentsTrack.scss'

function LoadingMessage() {
  return <div className="loading">Loading ...</div>
}

export default function AlignmentsTrack(props) {
  const { blockState } = props.model
  return (
    <div className="AlignmentsTrack">
      {blockState.filled ? (
        <TrackBlocks {...props} blockState={blockState} />
      ) : (
        <LoadingMessage />
      )}
    </div>
  )
}

AlignmentsTrack.propTypes = {
  model: PropTypes.observableObject.isRequired,
}
