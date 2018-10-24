import React from 'react'
import PropTypes from 'prop-types'

export default function Block({ offset, children, start, end, bpPerPx }) {
  const blockWidth = Math.abs(end - start) / bpPerPx
  return (
    <div
      style={{ left: `${offset}px`, width: `${blockWidth}px` }}
      className="block"
    >
      {children}
    </div>
  )
}

Block.defaultProps = { children: undefined }
Block.propTypes = {
  offset: PropTypes.number.isRequired,
  children: PropTypes.element,
  start: PropTypes.number.isRequired,
  end: PropTypes.number.isRequired,
  bpPerPx: PropTypes.number.isRequired,
}
