import { observer } from 'mobx-react'
import PropTypes from 'prop-types'
import React from 'react'

const MultilevelLinearComparativeDisplay: React.FC<{
  children?: React.ReactNode
}> = props => {
  const { children } = props
  return <div>{children}</div>
}
MultilevelLinearComparativeDisplay.propTypes = {
  children: PropTypes.element,
}

MultilevelLinearComparativeDisplay.defaultProps = {
  children: null,
}
export default observer(MultilevelLinearComparativeDisplay)
