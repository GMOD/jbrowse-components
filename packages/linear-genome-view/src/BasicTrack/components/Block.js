import { makeStyles } from '@material-ui/styles'
import classnames from 'classnames'
import { observer } from 'mobx-react'
import PropTypes from 'prop-types'
import React from 'react'

const useStyles = makeStyles((/* theme */) => ({
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
}))

function Block({ block, model, children }) {
  const classes = useStyles()
  return (
    <div
      style={{
        left: `${block.offsetPx - model.offsetPx}px`,
        width: `${block.widthPx}px`,
      }}
      className={classnames(classes.block, {
        [classes.leftBorder]: block.isLeftEndOfDisplayedRegion,
        [classes.rightBorder]: block.isRightEndOfDisplayedRegion,
      })}
    >
      {children}
    </div>
  )
}

Block.defaultProps = {
  children: undefined,
}
Block.propTypes = {
  model: PropTypes.shape().isRequired,
  block: PropTypes.shape().isRequired,
  children: PropTypes.oneOfType([
    PropTypes.node,
    PropTypes.arrayOf(PropTypes.node),
  ]),
}

export default observer(Block)
