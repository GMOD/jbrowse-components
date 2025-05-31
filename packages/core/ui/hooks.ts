/* eslint-env browser */

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
  open: (eventOrAnchorEl?: SyntheticEvent | Element | null) => void
  close: (eventOrAnchorEl?: SyntheticEvent | Element | null) => void
  toggle: (eventOrAnchorEl?: SyntheticEvent | Element | null) => void
  onBlur: (event: FocusEvent) => void
  onMouseLeave: (event: MouseEvent) => void
  setOpen: (
    open: boolean,
    eventOrAnchorEl?: SyntheticEvent | Element | null,
  ) => void
  isOpen: boolean
  anchorEl: Element | undefined
  anchorPosition: PopoverPosition | undefined
  setAnchorEl: (anchorEl: Element | null | undefined) => any
  setAnchorElUsed: boolean
  disableAutoFocus: boolean
  popupId: string | undefined
  variant: Variant
  hovered: boolean
  focused: boolean
  _openEventType: string | null | undefined
  _childPopupState: PopupState | null | undefined
  _setChildPopupState: (popupState: PopupState | null | undefined) => void
}

export interface CoreState {
  isOpen: boolean
  setAnchorElUsed: boolean
  anchorEl: Element | undefined
  anchorPosition: PopoverPosition | undefined
  hovered: boolean
  focused: boolean
  _openEventType: string | null | undefined
  _childPopupState: PopupState | null | undefined
}

export const initCoreState: CoreState = {
  isOpen: false,
  setAnchorElUsed: false,
  anchorEl: undefined,
  anchorPosition: undefined,
  hovered: false,
  focused: false,
  _openEventType: null,
  _childPopupState: null,
}

// https://github.com/jcoreio/material-ui-popup-state/issues/138
// Webpack prod build doesn't like it if we refer to React.useId conditionally,
// but aliasing to a variable like this works
const _react = React
const defaultPopupId =
  'useId' in _react
    ? () => _react.useId()
    : // istanbul ignore next
      () => undefined

export function usePopupState({
  parentPopupState,
  popupId = defaultPopupId(),
  variant,
  disableAutoFocus,
}: {
  parentPopupState?: PopupState | null | undefined
  popupId?: string | null
  variant: Variant
  disableAutoFocus?: boolean | null | undefined
}): PopupState {
  // Split the monolithic state into individual state variables
  const [isOpen, setIsOpen] = useState(false)
  const [setAnchorElUsed, setSetAnchorElUsed] = useState(false)
  const [anchorEl, _setAnchorEl] = useState<Element | undefined>(undefined)
  const [anchorPosition, setAnchorPosition] = useState<
    PopoverPosition | undefined
  >(undefined)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [openEventType, setOpenEventType] = useState<string | null | undefined>(
    null,
  )
  const [childPopupState, setChildPopupState] = useState<
    PopupState | null | undefined
  >(null)

  const setAnchorEl = useCallback((el: Element | null | undefined) => {
    setSetAnchorElUsed(true)
    _setAnchorEl(el ?? undefined)
  }, [])

  const toggle = (eventOrAnchorEl?: SyntheticEvent | Element | null) => {
    if (isOpen) {
      close(eventOrAnchorEl)
    } else {
      open(eventOrAnchorEl)
    }
    return {
      isOpen,
      setAnchorElUsed,
      anchorEl,
      anchorPosition,
      hovered,
      focused,
      _openEventType: openEventType,
      _childPopupState: childPopupState,
    } as CoreState
  }

  const open = (eventOrAnchorEl?: SyntheticEvent | Element | null) => {
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
        popupId: popupId ?? undefined,
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

      // Close any other popups at the current level before opening this one
      const currentChildPopupState = parentPopupState._childPopupState
      if (currentChildPopupState && currentChildPopupState !== self) {
        currentChildPopupState.close()
      }

      // Set this popup as the child of the parent
      setTimeout(() => parentPopupState._setChildPopupState(self))
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

  const close = (eventOrAnchorEl?: SyntheticEvent | Element | null) => {
    const event =
      eventOrAnchorEl instanceof Element ? undefined : eventOrAnchorEl

    if (event?.type === 'touchstart') {
      // No-op for touchstart
      return
    }

    // Close any child popup first
    childPopupState?.close()

    // Notify parent that we're closing
    parentPopupState?._setChildPopupState(null)

    // Update state variables
    setIsOpen(false)
    setHovered(false)
    setFocused(false)
  }

  const setOpen = (
    nextOpen: boolean,
    eventOrAnchorEl?: SyntheticEvent<any> | Element | null,
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

  const _setChildPopupState = (
    newChildPopupState: PopupState | null | undefined,
  ) => {
    setChildPopupState(newChildPopupState)
  }

  return {
    isOpen,
    anchorEl,
    anchorPosition,
    setAnchorElUsed,
    setAnchorEl,
    popupId: popupId ?? undefined,
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

/**
 * Creates a ref that sets the anchorEl for the popup.
 *
 * @param {object} popupState the argument passed to the child function of
 * `PopupState`
 */
export function anchorRef({
  setAnchorEl,
}: PopupState): (el: Element | null | undefined) => any {
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

/**
 * Creates props for a component that opens the popup when clicked.
 *
 * @param {object} popupState the argument passed to the child function of
 * `PopupState`
 */
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

/**
 * Creates props for a component that toggles the popup when clicked.
 *
 * @param {object} popupState the argument passed to the child function of
 * `PopupState`
 */
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

/**
 * Creates props for a component that opens the popup while hovered.
 *
 * @param {object} popupState the argument passed to the child function of
 * `PopupState`
 */
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

/**
 * Creates props for a component that opens the popup while focused.
 *
 * @param {object} popupState the argument passed to the child function of
 * `PopupState`
 */
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

/**
 * Creates props for a `Popover` component.
 *
 * @param {object} popupState the argument passed to the child function of
 * `PopupState`
 */
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
  anchorEl?: Element | null
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

/**
 * Creates props for a `Menu` component.
 *
 * @param {object} popupState the argument passed to the child function of
 * `PopupState`
 */

/**
 * Creates props for a `Popover` component.
 *
 * @param {object} popupState the argument passed to the child function of
 * `PopupState`
 */
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
  anchorEl?: Element | null
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
/**
 * Creates props for a `Popper` component.
 *
 * @param {object} popupState the argument passed to the child function of
 * `PopupState`
 */
export function bindPopper({
  isOpen,
  anchorEl,
  popupId,
  onMouseLeave,
}: PopupState): {
  id?: string
  anchorEl?: Element | null
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
