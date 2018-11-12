import React from 'react'
import PropTypes from 'prop-types'

export default function Block({ offset, children, width }) {
  return (
    <div
      style={{ left: `${-offset}px`, width: `${width}px` }}
      className="block"
    >
      {children}
    </div>
  )
}

Block.defaultProps = { children: undefined }
Block.propTypes = {
  offset: PropTypes.number.isRequired,
  width: PropTypes.number.isRequired,
  children: PropTypes.oneOfType([
    PropTypes.node,
    PropTypes.arrayOf(PropTypes.node),
  ]),
}
