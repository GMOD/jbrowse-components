import React from 'react'
import { observer, PropTypes } from 'mobx-react'

import BlockBasedTrack from '../../LinearGenomeView/components/BlockBasedTrack'

import './AlignmentsTrack.scss'

const AlignmentsTrack = observer(props => {
  const { blockState } = props.model
  return (
    <div className="AlignmentsTrack">
      <BlockBasedTrack {...props} blockState={blockState} />
    </div>
  )
})

AlignmentsTrack.propTypes = {
  model: PropTypes.observableObject.isRequired,
}

export default AlignmentsTrack
