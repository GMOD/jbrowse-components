import React from 'react'
import Paper from '@material-ui/core/Paper'
import { makeStyles } from '@material-ui/core/styles'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import ResizeHandle from './ResizeHandle'

const useStyles = makeStyles(theme => ({
  paper: {
    overflowY: 'auto',
    height: '100%',
    zIndex: theme.zIndex.drawer,
    outline: 'none',
    background: theme.palette.background.default,
  },
  resizeHandle: {
    width: 4,
    position: 'fixed',
    top: 0,
    zIndex: theme.zIndex.drawer + 1,
  },
}))

function Drawer({
  children,
  session,
}: {
  children: React.ReactNode
  session: { resizeDrawer: (arg: number) => number }
}) {
  const classes = useStyles()

  return (
    <Paper className={classes.paper} elevation={16} square>
      <ResizeHandle
        onDrag={session.resizeDrawer}
        className={classes.resizeHandle}
        vertical
      />
      {children}
    </Paper>
  )
}

Drawer.propTypes = {
  children: PropTypes.node,
  session: MobxPropTypes.observableObject.isRequired,
}

Drawer.defaultProps = {
  children: null,
}

export default observer(Drawer)
