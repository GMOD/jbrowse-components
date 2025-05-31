/* eslint-env browser */

import {
  type FocusEvent,
  type MouseEvent,
  type SyntheticEvent,
  type TouchEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import * as React from 'react'

import { type PopoverPosition, type PopoverReference } from '@mui/material'

const printedWarnings: Record<string, boolean> = {}

function warn(key: string, message: string) {
  if (printedWarnings[key]) {
    return
  }
  printedWarnings[key] = true

  console.error('[material-ui-popup-state] WARNING', message)
}

export type Variant = 'popover' | 'popper' | 'dialog'

export interface PopupState {
  open: (eventOrAnchorEl?: SyntheticEvent | Element | null) => void
  close: (eventOrAnchorEl?: SyntheticEvent | Element | null) => void
  toggle: (eventOrAnchorEl?: SyntheticEvent | Element | null) => void
  onBlur: (event: FocusEvent) => void
  onMouseLeave: (event: MouseEvent) => void
  onMouseEnter: () => void
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
  _openEventType: string | null | undefined
  _childPopupState: PopupState | null | undefined
  _setChildPopupState: (popupState: PopupState | null | undefined) => void
  _popupStateId?: string // Unique identifier for the popup state
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
  _mouseReEntered: boolean
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
  _mouseReEntered: false,
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
  closeDelay = 300,
}: {
  parentPopupState?: PopupState | null | undefined
  popupId?: string | null
  variant: Variant
  disableAutoFocus?: boolean | null | undefined
  closeDelay?: number
}): PopupState {
  const isMounted = useRef(true)
  const closeTimeoutRef = useRef<number | null>(null)

  useEffect((): (() => void) => {
    isMounted.current = true
    return () => {
      isMounted.current = false
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [])

  const [state, _setState] = useState(initCoreState)

  const setState = useCallback(
    (state: CoreState | ((prevState: CoreState) => CoreState)) => {
      if (isMounted.current) {
        _setState(state)
      }
    },
    [],
  )

  const setAnchorEl = useCallback((anchorEl: Element | null | undefined) => {
    setState(state => ({
      ...state,
      setAnchorElUsed: true,
      anchorEl: anchorEl ?? undefined,
    }))
  }, [])

  const toggle = (eventOrAnchorEl?: SyntheticEvent | Element | null) => {
    if (state.isOpen) {
      close(eventOrAnchorEl)
    } else {
      open(eventOrAnchorEl)
    }
    return state
  }

  const open = (eventOrAnchorEl?: SyntheticEvent | Element | null) => {
    // Clear any pending close timeout when opening
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }

    const event =
      eventOrAnchorEl instanceof Element ? undefined : eventOrAnchorEl
    const element =
      eventOrAnchorEl instanceof Element
        ? eventOrAnchorEl
        : eventOrAnchorEl?.currentTarget instanceof Element
          ? eventOrAnchorEl.currentTarget
          : undefined

    if (event?.type === 'touchstart') {
      setState(state => ({
        ...state,
      }))
      return
    }

    // Use MouseEvent type to access clientX and clientY
    const clientX = event && 'clientX' in event ? event.clientX : undefined
    const clientY = event && 'clientY' in event ? event.clientY : undefined
    const anchorPosition =
      typeof clientX === 'number' && typeof clientY === 'number'
        ? { left: clientX, top: clientY }
        : undefined

    setState((state: CoreState): CoreState => {
      if (!eventOrAnchorEl && !state.setAnchorElUsed && variant !== 'dialog') {
        warn(
          'missingEventOrAnchorEl',
          'eventOrAnchorEl should be defined if setAnchorEl is not used',
        )
      }

      if (parentPopupState) {
        if (!parentPopupState.isOpen) {
          return state
        }

        // Close any existing child popup states before setting this one
        const existingChild = parentPopupState._childPopupState
        if (
          existingChild &&
          existingChild._popupStateId !== popupState._popupStateId
        ) {
          existingChild.close()
        }

        setTimeout(() => {
          parentPopupState._setChildPopupState(popupState)
        })
      }

      const newState: CoreState = {
        ...state,
        isOpen: true,
        anchorPosition,
        hovered: event?.type === 'mouseover' || state.hovered,
        focused: event?.type === 'focus' || state.focused,
        _openEventType: event?.type,
      }

      if (!state.setAnchorElUsed) {
        if (event?.currentTarget) {
          newState.anchorEl = event.currentTarget as any
        } else if (element) {
          newState.anchorEl = element
        }
      }

      return newState
    })
  }

  const close = (eventOrAnchorEl?: SyntheticEvent | Element | null) => {
    const event =
      eventOrAnchorEl instanceof Element ? undefined : eventOrAnchorEl

    if (event?.type === 'touchstart') {
      setState(state => ({
        ...state,
      }))
      return
    }

    setState((state: CoreState): CoreState => {
      const { _childPopupState } = state
      setTimeout(() => {
        _childPopupState?.close()
        parentPopupState?._setChildPopupState(null)
      })
      return {
        ...state,
        isOpen: false,
        hovered: false,
        focused: false,
      }
    })
  }

  const setOpen = useCallback(
    (
      nextOpen: boolean,
      eventOrAnchorEl?: SyntheticEvent<any> | Element | null,
    ) => {
      if (nextOpen) {
        open(eventOrAnchorEl)
      } else {
        close(eventOrAnchorEl)
      }
    },
    [],
  )

  const onMouseEnter = useCallback(() => {
    setState((state: CoreState): CoreState => {
      return {
        ...state,
        _mouseReEntered: true,
        hovered: true,
      }
    })
  }, [setState])

  // Create a forward reference to popupState that will be defined later
  const popupStateRef = useRef<PopupState | null>(null)
  
  const onMouseLeave = useCallback((event: MouseEvent) => {
    const { relatedTarget } = event

    setState((state: CoreState): CoreState => {
      if (
        state.hovered &&
        !(
          relatedTarget instanceof Element &&
          popupStateRef.current && isElementInPopup(relatedTarget, popupStateRef.current)
        )
      ) {
        if (state.focused) {
          return { ...state, hovered: false }
        } else {
          // Clear any existing timeout
          if (closeTimeoutRef.current !== null) {
            window.clearTimeout(closeTimeoutRef.current)
          }

          // Set a new timeout to close the popup after the delay
          closeTimeoutRef.current = window.setTimeout(() => {
            if (isMounted.current) {
              setState((state: CoreState): CoreState => {
                // Don't close if mouse has re-entered during the timeout
                if (state._mouseReEntered) {
                  closeTimeoutRef.current = null
                  return state
                }
                
                const { _childPopupState } = state
                setTimeout(() => {
                  _childPopupState?.close()
                  parentPopupState?._setChildPopupState(null)
                })
                return {
                  ...state,
                  isOpen: false,
                  hovered: false,
                  focused: false,
                  _mouseReEntered: false,
                }
              })
              closeTimeoutRef.current = null
            }
          }, closeDelay)

          // Return the current state unchanged, the timeout will handle
          // closing
          return { ...state, _mouseReEntered: false }
        }
      }
      return state
    })
  }, [closeDelay, isMounted, parentPopupState, setState])

  const onBlur = (event?: FocusEvent) => {
    if (!event) {
      return
    }
    // const { relatedTarget } = event
    // setState((state: CoreState): CoreState => {
    //   if (
    //     state.focused &&
    //     !(
    //       relatedTarget instanceof Element &&
    //       isElementInPopup(relatedTarget, popupState)
    //     )
    //   ) {
    //     return state.hovered ? { ...state, focused: false } : doClose(state)
    //   }
    //   return state
    // })
  }

  const _setChildPopupState = useCallback(
    (_childPopupState: PopupState | null | undefined) => {
      setState(state => ({ ...state, _childPopupState }))
    },
    [],
  )

  // Generate a unique ID for this popup state instance
  const popupStateIdRef = useRef<string>(
    `popup_state_${Math.random().toString(36).substring(2, 11)}`,
  )

  const popupState: PopupState = popupStateRef.current = {
    ...state,
    setAnchorEl,
    popupId: popupId ?? undefined,
    variant,
    open,
    close,
    toggle,
    setOpen,
    onBlur,
    onMouseLeave,
    onMouseEnter,
    disableAutoFocus:
      disableAutoFocus ?? Boolean(state.hovered || state.focused),
    _setChildPopupState,
    _popupStateId: popupStateIdRef.current,
  }

  return popupState
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
 * Creates props for a component that opens the popup on its contextmenu event (right click).
 *
 * @param {object} popupState the argument passed to the child function of
 * `PopupState`
 */
export function bindContextMenu(popupState: PopupState): ControlAriaProps & {
  onContextMenu: (event: MouseEvent) => void
} {
  return {
    ...controlAriaProps(popupState),
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault()
      popupState.open(e)
    },
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
  onMouseEnter: () => any
} {
  const { open, onMouseLeave, onMouseEnter } = popupState
  return {
    ...controlAriaProps(popupState),
    onTouchStart: open,
    onMouseOver: open,
    onMouseLeave,
    onMouseEnter,
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
 * Creates props for a component that opens the popup while double click.
 *
 * @param {object} popupState the argument passed to the child function of
 * `PopupState`
 */
export function bindDoubleClick({
  isOpen,
  open,
  popupId,
  variant,
}: PopupState): {
  'aria-controls'?: string
  'aria-describedby'?: string
  'aria-haspopup'?: true
  onDoubleClick: (event: MouseEvent) => any
} {
  return {
    [variant === 'popover' ? 'aria-controls' : 'aria-describedby']: isOpen
      ? popupId
      : null,
    'aria-haspopup': variant === 'popover' ? true : undefined,
    onDoubleClick: open,
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
  onMouseEnter,
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
  onMouseEnter: () => void
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
    onMouseEnter,
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
  onMouseEnter,
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
  onMouseEnter: () => void
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
    onMouseEnter,
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
  onMouseEnter,
}: PopupState): {
  id?: string
  anchorEl?: Element | null
  open: boolean
  onMouseLeave: (event: MouseEvent) => void
  onMouseEnter: () => void
} {
  return {
    id: popupId,
    anchorEl,
    open: isOpen,
    onMouseLeave,
    onMouseEnter,
  }
}

/**
 * Creates props for a `Dialog` component.
 *
 * @param {object} popupState the argument passed to the child function of
 * `PopupState`
 */
export function bindDialog({ isOpen, close }: PopupState): {
  open: boolean
  onClose: (event: SyntheticEvent) => any
} {
  return {
    open: isOpen,
    onClose: close,
  }
}

function getPopup(
  element: Element,
  { popupId }: PopupState,
): Element | null | undefined {
  if (!popupId) {
    return null
  }
  const rootNode: any =
    typeof element.getRootNode === 'function' ? element.getRootNode() : document
  if (typeof rootNode.getElementById === 'function') {
    return rootNode.getElementById(popupId)
  }
  return null
}

function isElementInPopup(element: Element, popupState: PopupState): boolean {
  const { anchorEl, _childPopupState } = popupState
  return (
    isAncestor(anchorEl, element) ||
    isAncestor(getPopup(element, popupState), element) ||
    (_childPopupState != null && isElementInPopup(element, _childPopupState))
  )
}

function isAncestor(
  parent: Element | null | undefined,
  child: Element | null | undefined,
): boolean {
  if (!parent) {
    return false
  }
  while (child) {
    if (child === parent) {
      return true
    }
    child = child.parentElement
  }
  return false
}
