import { withStyles } from '@material-ui/core/styles'
import classnames from 'classnames'
import PropTypes from 'prop-types'
import React from 'react'

const styles = (/* theme */) => ({
  block: {
    position: 'absolute',
    minHeight: '100%',
    background: 'white',
    // background: theme.palette.background.default,
    boxSizing: 'border-box',
    whiteSpace: 'nowrap',
  },
  leftBorder: {
    borderLeft: `2px solid #333`,
    // borderLeft: `2px solid ${theme.palette.divider}`,
  },
  rightBorder: {
    borderRight: `2px solid #333`,
    // borderRight: `2px solid ${theme.palette.divider}`,
  },
})

function Block({ classes, offset, children, width, leftBorder, rightBorder }) {
  return (
    <div
      style={{ left: `${offset}px`, width: `${width}px` }}
      className={classnames(classes.block, {
        [classes.leftBorder]: leftBorder,
        [classes.rightBorder]: rightBorder,
      })}
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
  classes: PropTypes.objectOf(PropTypes.string).isRequired,
  offset: PropTypes.number.isRequired,
  width: PropTypes.number.isRequired,
  children: PropTypes.oneOfType([
    PropTypes.node,
    PropTypes.arrayOf(PropTypes.node),
  ]),
  leftBorder: PropTypes.bool,
  rightBorder: PropTypes.bool,
}

export default withStyles(styles)(Block)
