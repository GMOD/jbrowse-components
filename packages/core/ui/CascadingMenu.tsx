/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import type React from 'react'
import { useContext } from 'react'

import ChevronRight from '@mui/icons-material/ChevronRight'
import {
  CircularProgress,
  Divider,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
} from '@mui/material'

import CascadingMenuHelpIconButton from './CascadingMenuHelpIconButton'
import {
  CascadingContext,
  closeSiblingSubmenus,
  useAsyncMenuItems,
  useCascadingContext,
} from './CascadingMenuHooks'
import HoverMenu from './HoverMenu'
import { MenuItemEndDecoration } from './Menu'
import { bindFocus, bindHover, bindMenu, usePopupState } from './hooks'

import type { MenuItemsGetter } from './CascadingMenuHooks'
import type { MenuItem as JBMenuItem } from './Menu'
import type { PopupState } from './hooks'
import type { PopoverOrigin, SvgIconProps } from '@mui/material'



// ============================================================================
// Small UI components
// ============================================================================

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

function LoadingMenuItem() {
  return (
    <MenuItem disabled>
      <ListItemIcon>
        <CircularProgress size={20} />
      </ListItemIcon>
      <ListItemText primary="Loading..." />
    </MenuItem>
  )
}

function ErrorMenuItem({ error }: { error: unknown }) {
  return (
    <MenuItem disabled>
      <ListItemText
        primary="Error loading menu"
        secondary={error instanceof Error ? error.message : String(error)}
      />
    </MenuItem>
  )
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
  const hasHelpText = 'helpText' in item && item.helpText
  const isCheckOrRadio = item.type === 'checkbox' || item.type === 'radio'

  if (hasHelpText) {
    return (
      <CascadingMenuHelpIconButton helpText={item.helpText} label={item.label} />
    )
  }
  if (isCheckOrRadio && showSpacer) {
    return <HelpIconSpacer />
  }
  return null
}

// ============================================================================
// Menu item components
// ============================================================================

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
  const { rootPopupState, parentPopupState } = useContext(CascadingContext)

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
      onMouseOver={() => { closeSiblingSubmenus(parentPopupState) }}
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
  const { parentPopupState } = useContext(CascadingContext)
  const popupState = usePopupState({ parentPopupState })
  const { onMouseOver: originalOnMouseOver, ...hoverProps } =
    bindHover(popupState)

  return (
    <>
      <MenuItem
        {...bindFocus(popupState)}
        {...hoverProps}
        onMouseOver={event => {
          closeSiblingSubmenus(parentPopupState)
          originalOnMouseOver(event)
        }}
      >
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
        popupState={popupState}
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
  item: JBMenuItem
  hasIcon: boolean
  hasCheckboxOrRadioWithHelp: boolean
  closeAfterItemClick: boolean
  onMenuItemClick: Function
}) {
  return (
    <CascadingMenuItem
      closeAfterItemClick={closeAfterItemClick}
      onClick={
        'onClick' in item
          ? event => onMenuItemClick(event, item.onClick)
          : undefined
      }
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

// ============================================================================
// Menu container components
// ============================================================================

function CascadingSubmenuHover({
  popupState,
  children,
  ...props
}: {
  popupState: PopupState
  anchorOrigin: PopoverOrigin
  transformOrigin: PopoverOrigin
  children: React.ReactNode
}) {
  const context = useCascadingContext(popupState)

  return (
    <CascadingContext.Provider value={context}>
      {/* @ts-expect-error */}
      <HoverMenu {...props} {...bindMenu(popupState)}>
        {children}
      </HoverMenu>
    </CascadingContext.Provider>
  )
}

function CascadingMenu({
  popupState,
  children,
  ...props
}: {
  popupState: PopupState
  children?: React.ReactNode
}) {
  const context = useCascadingContext(popupState)

  return (
    <CascadingContext.Provider value={context}>
      {/* @ts-expect-error */}
      <Menu {...props} {...bindMenu(popupState)}>
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
            <Divider key={`divider-${JSON.stringify(item)}-${idx}`} component="li" />
          )
        }
        if (item.type === 'subHeader') {
          return (
            <ListSubheader key={`subHeader-${item.label}-${idx}`}>
              {item.label}
            </ListSubheader>
          )
        }
        return (
          <ActionMenuItem
            key={`${item.label}-${idx}`}
            item={item}
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

// ============================================================================
// Main export
// ============================================================================

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

export {type MenuItemsGetter} from './CascadingMenuHooks'