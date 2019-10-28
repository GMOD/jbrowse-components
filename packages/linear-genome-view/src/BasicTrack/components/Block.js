import { makeStyles } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import PropTypes from 'prop-types'
import React from 'react'

const useStyles = makeStyles((/* theme */) => ({
  block: {
    minHeight: '100%',
    background: 'white',
    // background: theme.palette.background.default,
    boxSizing: 'border-box',
    whiteSpace: 'nowrap',
  },
}))

function Block(props) {
  const { block, children } = props
  const classes = useStyles()
  return (
    <div
      style={{
        width: `${block.widthPx}px`,
      }}
      className={classes.block}
    >
      {children}
    </div>
  )
}

Block.defaultProps = {
  children: undefined,
}
Block.propTypes = {
  block: PropTypes.shape().isRequired,
  children: PropTypes.oneOfType([
    PropTypes.node,
    PropTypes.arrayOf(PropTypes.node),
  ]),
}

export default observer(Block)
