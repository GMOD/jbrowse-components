import { useEffect } from 'react'

import CascadingMenu from '@jbrowse/core/ui/CascadingMenu'
import {
  bindPopover,
  bindTrigger,
  usePopupState,
} from '@jbrowse/core/ui/hooks'
import { observer } from 'mobx-react'

import IconButton from './IconButton'

import type { MenuItemsGetter } from '@jbrowse/core/ui/CascadingMenu'

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
  menuItems: MenuItemsGetter
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
        disabled={Array.isArray(menuItems) && menuItems.length === 0}
      >
        {children}
      </IconButton>
      {isOpen ? (
        <CascadingMenu
          {...bindPopover(popupState)}
          onMenuItemClick={(_: unknown, callback: () => void) => {
            callback()
          }}
          menuItems={menuItems}
          closeAfterItemClick={closeAfterItemClick}
          popupState={popupState}
        />
      ) : null}
    </>
  )
})

export default CascadingMenuButton
