/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import type React from 'react'
import { useContext, useId, useState } from 'react'

import ChevronRight from '@mui/icons-material/ChevronRight'
import {
  Divider,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
} from '@mui/material'

import CascadingMenuHelpIconButton from './CascadingMenuHelpIconButton'
import HoverMenu from './HoverMenu'
import {
  ErrorMenuItem,
  LoadingMenuItem,
  MenuItemEndDecoration,
} from './MenuItems'
import { bindMenu } from './hooks'
import {
  CascadingContext,
  useAsyncMenuItems,
  useCascadingContext,
  useCloseSubmenu,
  useSubmenuContext,
  useSubmenuState,
} from './menuHooks'

import type {
  CheckboxMenuItem,
  MenuItem as JBMenuItem,
  MenuItemsGetter,
  NormalMenuItem,
  RadioMenuItem,
} from './MenuTypes'
import type { PopupState } from './hooks'
import type { PopoverOrigin, SvgIconProps } from '@mui/material'

export type { MenuItemsGetter } from './MenuTypes'
type ActionableMenuItem = NormalMenuItem | CheckboxMenuItem | RadioMenuItem

function HelpIconSpacer() {
  return (
    <div
      style={{
        marginLeft: 4,
        padding: 4,
        width: 28,
        height: 28,
      }}
    />
  )
}

function CascadingSpacer() {
  return <div style={{ flexGrow: 1, minWidth: 10 }} />
}

function EndDecoration({ item }: { item: JBMenuItem }) {
  if ('subMenu' in item) {
    return <MenuItemEndDecoration type="subMenu" />
  }
  if (item.type === 'checkbox' || item.type === 'radio') {
    return (
      <MenuItemEndDecoration
        type={item.type}
        checked={item.checked}
        disabled={item.disabled}
      />
    )
  }
  return null
}

function HelpButton({
  item,
  showSpacer,
}: {
  item: JBMenuItem
  showSpacer: boolean
}) {
  const helpText = 'helpText' in item ? item.helpText : undefined
  const isCheckOrRadio = item.type === 'checkbox' || item.type === 'radio'

  if (helpText) {
    return (
      <CascadingMenuHelpIconButton
        helpText={helpText}
        label={'label' in item ? item.label : undefined}
      />
    )
  }
  if (isCheckOrRadio && showSpacer) {
    return <HelpIconSpacer />
  }
  return null
}

function CascadingMenuItem({
  onClick,
  closeAfterItemClick,
  children,
  ...props
}: {
  closeAfterItemClick: boolean
  onClick?: (event: React.MouseEvent<HTMLLIElement>) => void
  disabled?: boolean
  children: React.ReactNode
}) {
  const { rootPopupState } = useContext(CascadingContext)
  const closeSubmenu = useCloseSubmenu()

  if (!rootPopupState) {
    throw new Error('must be used inside a CascadingMenu')
  }

  return (
    <MenuItem
      {...props}
      onClick={event => {
        if (closeAfterItemClick) {
          rootPopupState.close()
        }
        onClick?.(event)
      }}
      onMouseOver={closeSubmenu}
    >
      {children}
    </MenuItem>
  )
}

function CascadingSubmenu({
  title,
  Icon,
  inset,
  menuItems,
  onMenuItemClick,
  closeAfterItemClick,
}: {
  title: React.ReactNode
  onMenuItemClick: Function
  Icon: React.ComponentType<SvgIconProps> | undefined
  inset: boolean
  menuItems: JBMenuItem[]
  closeAfterItemClick: boolean
}) {
  const submenuId = useId()
  const { isOpen, open, close } = useSubmenuState(submenuId)
  const [anchorEl, setAnchorEl] = useState<HTMLLIElement | null>(null)

  return (
    <>
      <MenuItem ref={setAnchorEl} onMouseOver={open} onFocus={open}>
        {Icon ? (
          <ListItemIcon>
            <Icon />
          </ListItemIcon>
        ) : null}
        <ListItemText primary={title} inset={inset} />
        <ChevronRight />
      </MenuItem>
      <CascadingSubmenuHover
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        isOpen={isOpen}
        anchorEl={anchorEl}
        onClose={close}
      >
        <CascadingMenuList
          closeAfterItemClick={closeAfterItemClick}
          onMenuItemClick={onMenuItemClick}
          menuItems={menuItems}
        />
      </CascadingSubmenuHover>
    </>
  )
}

function ActionMenuItem({
  item,
  hasIcon,
  hasCheckboxOrRadioWithHelp,
  closeAfterItemClick,
  onMenuItemClick,
}: {
  item: ActionableMenuItem
  hasIcon: boolean
  hasCheckboxOrRadioWithHelp: boolean
  closeAfterItemClick: boolean
  onMenuItemClick: Function
}) {
  return (
    <CascadingMenuItem
      closeAfterItemClick={closeAfterItemClick}
      onClick={event => onMenuItemClick(event, item.onClick)}
      disabled={Boolean(item.disabled)}
    >
      {item.icon ? (
        <ListItemIcon>
          <item.icon />
        </ListItemIcon>
      ) : null}
      <ListItemText
        primary={item.label}
        secondary={item.subLabel}
        inset={hasIcon && !item.icon}
      />
      <CascadingSpacer />
      <EndDecoration item={item} />
      <HelpButton item={item} showSpacer={hasCheckboxOrRadioWithHelp} />
    </CascadingMenuItem>
  )
}

function CascadingSubmenuHover({
  isOpen,
  anchorEl,
  onClose,
  children,
  anchorOrigin,
  transformOrigin,
}: {
  isOpen: boolean
  anchorEl: Element | null
  onClose: () => void
  anchorOrigin: PopoverOrigin
  transformOrigin: PopoverOrigin
  children: React.ReactNode
}) {
  const context = useSubmenuContext()

  return (
    <CascadingContext.Provider value={context}>
      <HoverMenu
        open={isOpen}
        anchorEl={anchorEl}
        onClose={onClose}
        anchorOrigin={anchorOrigin}
        transformOrigin={transformOrigin}
      >
        {children}
      </HoverMenu>
    </CascadingContext.Provider>
  )
}

function CascadingMenu({
  popupState,
  children,
}: {
  popupState: PopupState
  children?: React.ReactNode
}) {
  const context = useCascadingContext(popupState)
  const { anchorEl, onClose, ...menuProps } = bindMenu(popupState)

  return (
    <CascadingContext.Provider value={context}>
      <Menu
        {...menuProps}
        anchorEl={anchorEl ?? null}
        onClose={() => {
          onClose()
        }}
      >
        {children}
      </Menu>
    </CascadingContext.Provider>
  )
}

function CascadingMenuList({
  onMenuItemClick,
  closeAfterItemClick,
  menuItems,
}: {
  menuItems: JBMenuItem[]
  closeAfterItemClick: boolean
  onMenuItemClick: Function
}) {
  const hasIcon = menuItems.some(m => 'icon' in m && m.icon)
  const hasCheckboxOrRadioWithHelp = menuItems.some(
    m =>
      (m.type === 'checkbox' || m.type === 'radio') &&
      'helpText' in m &&
      m.helpText,
  )

  const sortedItems = menuItems.toSorted(
    (a, b) => (b.priority || 0) - (a.priority || 0),
  )

  return (
    <>
      {sortedItems.map((item, idx) => {
        if ('subMenu' in item) {
          return (
            <CascadingSubmenu
              key={`subMenu-${item.label}-${idx}`}
              title={item.label}
              Icon={item.icon}
              inset={hasIcon && !item.icon}
              onMenuItemClick={onMenuItemClick}
              menuItems={item.subMenu}
              closeAfterItemClick={closeAfterItemClick}
            />
          )
        }
        if (item.type === 'divider') {
          return (
            <Divider
              key={`divider-${JSON.stringify(item)}-${idx}`}
              component="li"
            />
          )
        }
        if (item.type === 'subHeader') {
          return (
            <ListSubheader key={`subHeader-${item.label}-${idx}`}>
              {item.label}
            </ListSubheader>
          )
        }
        const actionItem = item as ActionableMenuItem
        return (
          <ActionMenuItem
            key={`${actionItem.label}-${idx}`}
            item={actionItem}
            hasIcon={hasIcon}
            hasCheckboxOrRadioWithHelp={hasCheckboxOrRadioWithHelp}
            closeAfterItemClick={closeAfterItemClick}
            onMenuItemClick={onMenuItemClick}
          />
        )
      })}
    </>
  )
}

function CascadingMenuChildren(props: {
  onMenuItemClick: Function
  closeAfterItemClick?: boolean
  menuItems: MenuItemsGetter
  popupState: PopupState
}) {
  const { closeAfterItemClick = true, menuItems, popupState, ...rest } = props
  const { items, loading, error } = useAsyncMenuItems(
    menuItems,
    popupState.isOpen,
  )

  return (
    <CascadingMenu {...rest} popupState={popupState}>
      {loading ? (
        <LoadingMenuItem />
      ) : error ? (
        <ErrorMenuItem error={error} />
      ) : (
        <CascadingMenuList
          {...rest}
          menuItems={items}
          closeAfterItemClick={closeAfterItemClick}
        />
      )}
    </CascadingMenu>
  )
}

export default CascadingMenuChildren
