import React, { Component } from 'react'
import { observer, PropTypes } from 'mobx-react'

import TrackBlocks from '../../LinearGenomeView/components/TrackBlocks'

import './AlignmentsTrack.scss'

function LoadingMessage() {
  return <div className="loading">Loading ...</div>
}

function ErrorMessage({ error }) {
  return <div className="error">{error.message}</div>
}
ErrorMessage.propTypes = {
  error: PropTypes.objectOrObservableObject.isRequired,
}

const Block = observer(({ model }) => {
  if (model.error) return <ErrorMessage error={model.error} />
  if (!model.filled) return <LoadingMessage />
  return <div dangerouslySetInnerHTML={{ __html: model.html }} />
})

Block.propTypes = {
  model: PropTypes.observableObject.isRequired,
}

export const AlignmentsTrackBlock = Block

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
