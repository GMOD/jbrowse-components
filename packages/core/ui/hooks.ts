/* eslint-env browser */

//  this code adapted from material-ui-popup-state by Andy Edwards, MIT license
//  https://github.com/jcoreio/material-ui-popup-state/blob/9dba66241a0c25b172c93ae7d9e45a9745f138e8/LICENSE.md
//  the main changes included
//
//  - refactoring to use separate useState variables
//  - removal of 'efficiency' hooks like useCallback, useEvent...favor correctness
//  - to not close the menu onMouseLeave
import {
  type FocusEvent,
  type MouseEvent,
  type SyntheticEvent,
  type TouchEvent,
  useCallback,
  useState,
} from 'react'
import * as React from 'react'

import type { PopoverPosition, PopoverReference } from '@mui/material'

export type Variant = 'popover' | 'popper' | 'dialog'

export interface PopupState {
  open: (eventOrAnchorEl?: SyntheticEvent | Element) => void
  close: (eventOrAnchorEl?: SyntheticEvent | Element) => void
  toggle: (eventOrAnchorEl?: SyntheticEvent | Element) => void
  onBlur: (event: FocusEvent) => void
  onMouseLeave: (event: MouseEvent) => void
  setOpen: (open: boolean, eventOrAnchorEl?: SyntheticEvent | Element) => void
  isOpen: boolean
  anchorEl: Element | undefined
  anchorPosition: PopoverPosition | undefined
  setAnchorEl: (anchorEl: Element | undefined) => any
  setAnchorElUsed: boolean
  disableAutoFocus: boolean
  popupId: string | undefined
  variant: Variant
  hovered: boolean
  focused: boolean
  _openEventType?: string
  _childPopupState?: PopupState
  _setChildPopupState: (popupState?: PopupState) => void
}

export interface CoreState {
  isOpen: boolean
  setAnchorElUsed: boolean
  anchorEl: Element | undefined
  anchorPosition?: PopoverPosition
  hovered: boolean
  focused: boolean
  _openEventType?: string
  _childPopupState?: PopupState
}

export function usePopupState({
  parentPopupState,
  variant,
  disableAutoFocus,
}: {
  parentPopupState?: PopupState
  variant: Variant
  disableAutoFocus?: boolean
}): PopupState {
  const popupId = React.useId()
  const [isOpen, setIsOpen] = useState(false)
  const [setAnchorElUsed, setSetAnchorElUsed] = useState(false)
  const [anchorEl, _setAnchorEl] = useState<Element>()
  const [anchorPosition, setAnchorPosition] = useState<PopoverPosition>()
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [openEventType, setOpenEventType] = useState<string>()
  const [childPopupState, setChildPopupState] = useState<PopupState>()

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

    const clientX = (event as MouseEvent | undefined)?.clientX
    const clientY = (event as MouseEvent | undefined)?.clientY
    const newAnchorPosition =
      typeof clientX === 'number' && typeof clientY === 'number'
        ? { left: clientX, top: clientY }
        : undefined

    if (parentPopupState) {
      if (!parentPopupState.isOpen) {
        return
      }

      // Create self reference to use in setTimeout and comparison
      const self = {
        isOpen,
        anchorEl,
        anchorPosition,
        setAnchorElUsed,
        setAnchorEl,
        popupId,
        variant,
        open,
        close,
        toggle,
        setOpen,
        onBlur,
        onMouseLeave,
        hovered,
        focused,
        _openEventType: openEventType,
        _childPopupState: childPopupState,
        disableAutoFocus: disableAutoFocus ?? Boolean(hovered || focused),
        _setChildPopupState,
      } as PopupState

      parentPopupState._setChildPopupState(undefined)

      // Set this popup as the child of the parent
      setTimeout(() => {
        parentPopupState._setChildPopupState(self)
      })
    }

    // Update individual state variables
    setIsOpen(true)
    setAnchorPosition(newAnchorPosition)
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
    childPopupState?.close()

    // Notify parent that we're closing
    parentPopupState?._setChildPopupState(undefined)

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

  const onMouseLeave = useCallback((_event: MouseEvent) => {
    // changed to do nothing compared to material-ui-popup-state
  }, [])

  const onBlur = useCallback((_event?: FocusEvent) => {
    // changed to do nothing compared to material-ui-popup-state
  }, [])

  const _setChildPopupState = (newChildPopupState?: PopupState) => {
    setChildPopupState(newChildPopupState)
  }

  return {
    isOpen,
    anchorEl,
    anchorPosition,
    setAnchorElUsed,
    setAnchorEl,
    popupId,
    variant,
    open,
    close,
    toggle,
    setOpen,
    onBlur,
    onMouseLeave,
    hovered,
    focused,
    _openEventType: openEventType,
    _childPopupState: childPopupState,
    disableAutoFocus: disableAutoFocus ?? Boolean(hovered || focused),
    _setChildPopupState,
  }
}

export function anchorRef({ setAnchorEl }: PopupState): (el?: Element) => any {
  return setAnchorEl
}

interface ControlAriaProps {
  'aria-controls'?: string
  'aria-describedby'?: string
  'aria-haspopup'?: true
}

function controlAriaProps({
  isOpen,
  popupId,
  variant,
}: PopupState): ControlAriaProps {
  return {
    ...(variant === 'popover'
      ? {
          'aria-haspopup': true,
          'aria-controls': isOpen ? popupId : undefined,
        }
      : variant === 'popper'
        ? { 'aria-describedby': isOpen ? popupId : undefined }
        : undefined),
  }
}

export function bindTrigger(popupState: PopupState): ControlAriaProps & {
  onClick: (event: MouseEvent) => void
  onTouchStart: (event: TouchEvent) => void
} {
  return {
    ...controlAriaProps(popupState),
    onClick: popupState.open,
    onTouchStart: popupState.open,
  }
}

export function bindToggle(popupState: PopupState): ControlAriaProps & {
  onClick: (event: MouseEvent) => void
  onTouchStart: (event: TouchEvent) => void
} {
  return {
    ...controlAriaProps(popupState),
    onClick: popupState.toggle,
    onTouchStart: popupState.toggle,
  }
}

export function bindHover(popupState: PopupState): ControlAriaProps & {
  onTouchStart: (event: TouchEvent) => any
  onMouseOver: (event: MouseEvent) => any
  onMouseLeave: (event: MouseEvent) => any
} {
  const { open, onMouseLeave } = popupState
  return {
    ...controlAriaProps(popupState),
    onTouchStart: open,
    onMouseOver: open,
    onMouseLeave,
  }
}

export function bindFocus(popupState: PopupState): ControlAriaProps & {
  onFocus: (event: FocusEvent) => any
  onBlur: (event: FocusEvent) => any
} {
  const { open, onBlur } = popupState
  return {
    ...controlAriaProps(popupState),
    onFocus: open,
    onBlur,
  }
}

export function bindPopover({
  isOpen,
  anchorEl,
  anchorPosition,
  close,
  popupId,
  onMouseLeave,
  disableAutoFocus,
  _openEventType,
}: PopupState): {
  id?: string
  anchorEl?: Element
  anchorPosition?: PopoverPosition
  anchorReference: PopoverReference
  open: boolean
  onClose: () => void
  onMouseLeave: (event: MouseEvent) => void
  disableAutoFocus?: boolean
  disableEnforceFocus?: boolean
  disableRestoreFocus?: boolean
} {
  const usePopoverPosition = _openEventType === 'contextmenu'
  return {
    id: popupId,
    anchorEl,
    anchorPosition,
    anchorReference: usePopoverPosition ? 'anchorPosition' : 'anchorEl',
    open: isOpen,
    onClose: close,
    onMouseLeave,
    ...(disableAutoFocus && {
      disableAutoFocus: true,
      disableEnforceFocus: true,
      disableRestoreFocus: true,
    }),
  }
}

export function bindMenu({
  isOpen,
  anchorEl,
  anchorPosition,
  close,
  popupId,
  onMouseLeave,
  disableAutoFocus,
  _openEventType,
}: PopupState): {
  id?: string
  anchorEl?: Element
  anchorPosition?: PopoverPosition
  anchorReference: PopoverReference
  open: boolean
  onClose: () => void
  onMouseLeave: (event: MouseEvent) => void
  autoFocus?: boolean
  disableAutoFocusItem?: boolean
  disableAutoFocus?: boolean
  disableEnforceFocus?: boolean
  disableRestoreFocus?: boolean
} {
  const usePopoverPosition = _openEventType === 'contextmenu'
  return {
    id: popupId,
    anchorEl,
    anchorPosition,
    anchorReference: usePopoverPosition ? 'anchorPosition' : 'anchorEl',
    open: isOpen,
    onClose: close,
    onMouseLeave,
    ...(disableAutoFocus && {
      autoFocus: false,
      disableAutoFocusItem: true,
      disableAutoFocus: true,
      disableEnforceFocus: true,
      disableRestoreFocus: true,
    }),
  }
}

export function bindPopper({
  isOpen,
  anchorEl,
  popupId,
  onMouseLeave,
}: PopupState): {
  id?: string
  anchorEl?: Element
  open: boolean
  onMouseLeave: (event: MouseEvent) => void
} {
  return {
    id: popupId,
    anchorEl,
    open: isOpen,
    onMouseLeave,
  }
}
