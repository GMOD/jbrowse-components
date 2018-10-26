import React from 'react'
import PropTypes from 'prop-types'
import Drawer from '@material-ui/core/Drawer'

function SideDrawer(props) {
  const { children, className } = props

  return (
    <Drawer
      variant="permanent"
      anchor="right"
      className={className}
      classes={{
        paper: className,
      }}
    >
      {children}
    </Drawer>
  )
}

SideDrawer.propTypes = {
  className: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
}

export default SideDrawer
