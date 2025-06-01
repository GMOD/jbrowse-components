import { useEffect } from 'react'

import CascadingMenu from '@jbrowse/core/ui/CascadingMenu'
import { IconButton } from '@mui/material'
import { observer } from 'mobx-react'

import { bindPopover, bindTrigger, usePopupState } from './hooks'

import type { MenuItem } from '@jbrowse/core/ui'

const CascadingMenuButton = observer(function CascadingMenuButton({
  children,
  menuItems,
  closeAfterItemClick = true,
  stopPropagation,
  setOpen,
  onClick: onClickExtra,
  ...rest
}: {
  children?: React.ReactElement
  menuItems: MenuItem[]
  closeAfterItemClick?: boolean
  stopPropagation?: boolean
  onClick?: () => void
  setOpen?: (arg: boolean) => void
  [key: string]: unknown
}) {
  const popupState = usePopupState()
  const { onClick, ...rest2 } = bindTrigger(popupState)
  const { isOpen } = popupState
  useEffect(() => {
    setOpen?.(isOpen)
  }, [isOpen, setOpen])

  return (
    <>
      <IconButton
        onClick={event => {
          if (stopPropagation) {
            event.stopPropagation()
          }
          onClick(event)
          onClickExtra?.()
        }}
        {...rest2}
        {...rest}
        disabled={menuItems.length === 0}
      >
        {children}
      </IconButton>
      <CascadingMenu
        {...bindPopover(popupState)}
        onMenuItemClick={(_: unknown, callback: () => void) => {
          callback()
        }}
        menuItems={menuItems}
        closeAfterItemClick={closeAfterItemClick}
        popupState={popupState}
      />
    </>
  )
})

export default CascadingMenuButton
