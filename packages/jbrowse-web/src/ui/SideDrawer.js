import React from 'react'
import Drawer from '@material-ui/core/Drawer'

function SideDrawer(props) {
  const { children, ...others } = props

  return (
    <Drawer variant="permanent" anchor="right" {...others}>
      {children}
    </Drawer>
  )
}

export default SideDrawer
