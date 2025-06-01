/* eslint-env browser */

//  this code adapted from material-ui-popup-state by Andy Edwards, MIT license
//  https://github.com/jcoreio/material-ui-popup-state/blob/9dba66241a0c25b172c93ae7d9e45a9745f138e8/LICENSE.md
//  the main changes included
//
//  - refactoring to use separate useState variables
//  - removal of 'efficiency' hooks like useCallback, useEvent...favor correctness
//  - to not close the menu onMouseLeave
import { type SyntheticEvent, useCallback, useState } from 'react'
import * as React from 'react'

export interface ChildHandle {
  close: () => void
  popupId: string
}

export interface PopupState {
  open: (event?: React.MouseEvent | React.FocusEvent) => void
  close: (event?: React.MouseEvent) => void
  toggle: (event?: React.MouseEvent) => void
  setOpen: (open: boolean, eventOrAnchorEl?: SyntheticEvent | Element) => void
  isOpen: boolean
  anchorEl: Element | undefined
  setAnchorEl: (anchorEl: Element | undefined) => any
  setAnchorElUsed: boolean
  popupId: string | undefined
  hovered: boolean
  focused: boolean
  _openEventType?: string
  childHandle?: ChildHandle
  setChildHandle: (popupState?: ChildHandle) => void
}

export interface CoreState {
  isOpen: boolean
  setAnchorElUsed: boolean
  anchorEl: Element | undefined
  hovered: boolean
  focused: boolean
  _openEventType?: string
  _childHandle?: PopupState
}

export function usePopupState(arg?: {
  parentPopupState?: PopupState
  variant?: string
}): PopupState {
  const { parentPopupState } = arg || {}
  const popupId = React.useId()
  const [isOpen, setIsOpen] = useState(false)
  const [setAnchorElUsed, setSetAnchorElUsed] = useState(false)
  const [anchorEl, _setAnchorEl] = useState<Element>()
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [openEventType, setOpenEventType] = useState<string>()
  const [childHandle, setChildHandle] = useState<ChildHandle>()

  const setAnchorEl = useCallback((el?: Element) => {
    setSetAnchorElUsed(true)
    _setAnchorEl(el)
  }, [])

  const toggle = (eventOrAnchorEl?: SyntheticEvent | Element) => {
    if (isOpen) {
      close(eventOrAnchorEl)
    } else {
      open(eventOrAnchorEl)
    }
  }

  const open = (eventOrAnchorEl?: SyntheticEvent | Element) => {
    const event =
      eventOrAnchorEl instanceof Element ? undefined : eventOrAnchorEl
    const element =
      eventOrAnchorEl instanceof Element
        ? eventOrAnchorEl
        : eventOrAnchorEl?.currentTarget instanceof Element
          ? eventOrAnchorEl.currentTarget
          : undefined

    if (event?.type === 'touchstart') {
      // No-op for touchstart, just maintain current state
      return
    }

    if (parentPopupState) {
      if (!parentPopupState.isOpen) {
        return
      }

      // Create self reference to use in setTimeout and comparison

      parentPopupState.setChildHandle(undefined)

      // Set this popup as the child of the parent
      setTimeout(() => {
        parentPopupState.setChildHandle({
          popupId,
          close,
        })
      })
    }

    // Update individual state variables
    setIsOpen(true)
    setHovered(prev => event?.type === 'mouseover' || prev)
    setFocused(prev => event?.type === 'focus' || prev)
    setOpenEventType(event?.type)

    // Update anchorEl if not set manually
    if (!setAnchorElUsed) {
      if (event?.currentTarget) {
        _setAnchorEl(event.currentTarget as any)
      } else if (element) {
        _setAnchorEl(element)
      }
    }
  }

  const close = (eventOrAnchorEl?: SyntheticEvent | Element) => {
    const event =
      eventOrAnchorEl instanceof Element ? undefined : eventOrAnchorEl

    if (event?.type === 'touchstart') {
      // No-op for touchstart
      return
    }

    // Close any child popup first
    childHandle?.close()

    // Notify parent that we're closing
    parentPopupState?.setChildHandle(undefined)

    // Update state variables
    setIsOpen(false)
    setHovered(false)
    setFocused(false)
  }

  const setOpen = (
    nextOpen: boolean,
    eventOrAnchorEl?: SyntheticEvent<any> | Element,
  ) => {
    if (nextOpen) {
      open(eventOrAnchorEl)
    } else {
      close(eventOrAnchorEl)
    }
  }

  return {
    isOpen,
    anchorEl,
    setAnchorElUsed,
    setAnchorEl,
    popupId,
    open,
    close,
    toggle,
    setOpen,
    hovered,
    focused,
    _openEventType: openEventType,
    childHandle,
    setChildHandle,
  }
}

export function bindTrigger(popupState: PopupState) {
  return {
    onClick: popupState.open,
  }
}

export function bindToggle(popupState: PopupState) {
  return {
    onClick: popupState.toggle,
  }
}

export function bindHover(popupState: PopupState) {
  const { open } = popupState
  return {
    onMouseOver: open,
  }
}

export function bindFocus(popupState: PopupState) {
  const { open } = popupState
  return {
    onFocus: open,
  }
}

export function bindPopover({ isOpen, anchorEl, close, popupId }: PopupState) {
  return {
    id: popupId,
    anchorEl,
    anchorReference: 'anchorEl' as const,
    open: isOpen,
    onClose: close,
  }
}

export function bindMenu({ isOpen, anchorEl, close, popupId }: PopupState) {
  return {
    id: popupId,
    anchorEl,
    anchorReference: 'anchorEl' as const,
    open: isOpen,
    onClose: close,
  }
}

export function bindPopper({ isOpen, anchorEl, popupId }: PopupState) {
  return {
    id: popupId,
    anchorEl,
    open: isOpen,
  }
}
