import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React from 'react'
import { LinearComparativeDisplay as LCD } from '..'

const LinearComparativeDisplay: React.FC<{
  model: LCD
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
LinearComparativeDisplay.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
  children: PropTypes.element,
}

LinearComparativeDisplay.defaultProps = {
  children: null,
}
export default observer(LinearComparativeDisplay)
