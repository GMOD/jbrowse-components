import React from 'react'
import PropTypes from 'prop-types'
import classnames from 'classnames'

export default function Block({
  offset,
  children,
  width,
  leftBorder,
  rightBorder,
}) {
  return (
    <div
      style={{ left: `${-offset}px`, width: `${width}px` }}
      className={classnames(
        'block',
        leftBorder && 'left-side',
        rightBorder && 'right-side',
      )}
    >
      {children}
    </div>
  )
}

Block.defaultProps = {
  children: undefined,
  leftBorder: false,
  rightBorder: false,
}
Block.propTypes = {
  offset: PropTypes.number.isRequired,
  width: PropTypes.number.isRequired,
  children: PropTypes.oneOfType([
    PropTypes.node,
    PropTypes.arrayOf(PropTypes.node),
  ]),
  leftBorder: PropTypes.bool,
  rightBorder: PropTypes.bool,
}
