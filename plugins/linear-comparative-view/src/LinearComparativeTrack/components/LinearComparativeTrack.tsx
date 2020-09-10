import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React from 'react'
import { LinearComparativeTrack as LCT } from '..'

const LinearComparativeTrack: React.FC<{
  model: LCT
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
LinearComparativeTrack.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
  children: PropTypes.element,
}

LinearComparativeTrack.defaultProps = {
  children: null,
}
export default observer(LinearComparativeTrack)
