import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React from 'react'
import { DotplotTrack as DotplotTrackModel } from '..'

const DotplotTrack: React.FC<{
  model: DotplotTrackModel
  children?: React.ReactNode
}> = props => {
  const { model, children } = props
  return (
    <div>
      <model.ReactComponent2 {...props} />
      {children}
    </div>
  )
}
DotplotTrack.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
  children: PropTypes.element,
}

DotplotTrack.defaultProps = {
  children: null,
}
export default observer(DotplotTrack)
