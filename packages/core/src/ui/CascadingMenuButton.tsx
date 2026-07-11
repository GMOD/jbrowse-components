import { useState } from 'react'

import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'

import CascadingMenu from './CascadingMenu.tsx'

import type { MenuItemsGetter } from './CascadingMenu.tsx'
import type { PopoverOrigin } from '@mui/material'

// drop the menu below the trigger icon rather than overlapping it (MUI's
// default top/left anchor)
const dropdownAnchorOrigin = { vertical: 'bottom', horizontal: 'left' } as const
const dropdownTransformOrigin = { vertical: 'top', horizontal: 'left' } as const

// A disabled button has pointer-events:none, so a Tooltip placed directly on it
// never fires; wrap it in a span (per MUI guidance) to restore the hover. The
// wrapper is only added when disabled, so enabled buttons keep their layout.
function MaybeTooltip({
  title,
  disabled,
  children,
}: {
  title?: string
  disabled?: boolean
  children: React.ReactElement
}) {
  return title ? (
    <Tooltip title={title}>
      {disabled ? <span>{children}</span> : children}
    </Tooltip>
  ) : (
    children
  )
}

function CascadingMenuButton({
  children,
  menuItems,
  closeAfterItemClick = true,
  stopPropagation,
  disabled,
  setOpen,
  ButtonComponent = IconButton,
  onClick: onClickExtra,
  anchorOrigin = dropdownAnchorOrigin,
  transformOrigin = dropdownTransformOrigin,
  tooltip,

  ...rest
}: {
  children?: React.ReactNode
  menuItems: MenuItemsGetter
  closeAfterItemClick?: boolean
  stopPropagation?: boolean
  disabled?: boolean
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
  setOpen?: (arg: boolean) => void
  ButtonComponent?: React.FC<{
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
    disabled?: boolean
    children?: React.ReactNode
    'aria-label'?: string
  }>
  anchorOrigin?: PopoverOrigin
  transformOrigin?: PopoverOrigin
  tooltip?: string
  [key: string]: unknown
}) {
  const [anchorEl, setAnchorEl] = useState<Element | null>(null)
  const open = Boolean(anchorEl)

  // an empty array can be detected up front to grey out the button; a getter
  // can't be checked without calling it, which we defer to click time below.
  // callers that know a getter may be empty can pass `disabled` explicitly
  const isDisabled =
    disabled ?? (Array.isArray(menuItems) && menuItems.length === 0)

  return (
    <>
      <MaybeTooltip title={tooltip} disabled={isDisabled}>
        <ButtonComponent
          aria-label={tooltip}
          onClick={event => {
            if (stopPropagation) {
              event.stopPropagation()
            }
            // resolve here (only on click, never per-render) so a getter that
            // yields no items opens nothing rather than an empty popover
            const items = Array.isArray(menuItems) ? menuItems : menuItems()
            if (items.length > 0) {
              setAnchorEl(event.currentTarget)
              setOpen?.(true)
            }
            onClickExtra?.(event)
          }}
          {...rest}
          disabled={isDisabled}
        >
          {children}
        </ButtonComponent>
      </MaybeTooltip>
      {open ? (
        <CascadingMenu
          open={open}
          onClose={() => {
            setAnchorEl(null)
            setOpen?.(false)
          }}
          anchorEl={anchorEl}
          anchorOrigin={anchorOrigin}
          transformOrigin={transformOrigin}
          menuItems={menuItems}
          closeAfterItemClick={closeAfterItemClick}
          onMenuItemClick={callback => {
            callback()
          }}
        />
      ) : null}
    </>
  )
}

export default CascadingMenuButton
