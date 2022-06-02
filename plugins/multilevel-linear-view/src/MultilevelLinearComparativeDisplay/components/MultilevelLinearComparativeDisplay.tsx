import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React from 'react'
import { MultilevelLinearComparativeDisplay as LCD } from '..'

const MultilevelLinearComparativeDisplay: React.FC<{
  model: LCD
  children?: React.ReactNode
}> = props => {
  const { children } = props
  return <div>{children}</div>
}
MultilevelLinearComparativeDisplay.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
  children: PropTypes.element,
}

MultilevelLinearComparativeDisplay.defaultProps = {
  children: null,
}
export default observer(MultilevelLinearComparativeDisplay)
