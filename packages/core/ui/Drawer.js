import Paper from '@material-ui/core/Paper'
import Slide from '@material-ui/core/Slide'
import { makeStyles } from '@material-ui/core/styles'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React from 'react'
import ResizeHandle from './ResizeHandle'

const useStyles = makeStyles(theme => ({
  paper: {
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    flex: '1 0 auto',
    zIndex: theme.zIndex.drawer,
    top: 0,
    outline: 'none',
    left: 'auto',
    right: 0,
    background: theme.palette.background.default,
  },
}))

function Drawer({ children, open, session }) {
  const classes = useStyles()

  return (
    <Slide in={open} direction="left">
      <Paper
        style={{ width: open ? session.drawerWidth : 0 }}
        className={classes.paper}
        elevation={16}
        square
      >
        <ResizeHandle
          onDrag={session.resizeDrawer}
          style={{
            width: 4,
            position: 'fixed',
            top: 0,
          }}
          vertical
        />
        {children}
      </Paper>
    </Slide>
  )
}

Drawer.propTypes = {
  children: PropTypes.node,
  open: PropTypes.bool.isRequired,
  session: MobxPropTypes.observableObject.isRequired,
}

Drawer.defaultProps = {
  children: null,
}

export default observer(Drawer)
