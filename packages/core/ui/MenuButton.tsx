import React, { useState } from 'react'
import Menu from '@jbrowse/core/ui/Menu'
import { IconButton } from '@mui/material'
import { observer } from 'mobx-react'
import { MenuItem } from '@jbrowse/core/ui'

const MenuButton = observer(function MenuButton({
  children,
  menuItems,
  ...rest
}: {
  children?: React.ReactElement
  menuItems: MenuItem[]
  [key: string]: unknown
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement>()
  return (
    <>
      <IconButton {...rest} onClick={event => setAnchorEl(event.currentTarget)}>
        {children}
      </IconButton>
      <Menu
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(undefined)}
        onMenuItemClick={(_: unknown, callback: Function) => {
          callback()
          setAnchorEl(undefined)
        }}
        menuItems={menuItems}
      />
    </>
  )
})

export default MenuButton
