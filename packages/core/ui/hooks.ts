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

import type { PopoverPosition, PopoverReference } from '@mui/material'

import { useEvent } from './useEvent'

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
  _deferNextOpen: boolean
  _deferNextClose: boolean
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
  _deferNextOpen: false,
  _deferNextClose: false,
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
  const isMounted = useRef(true)

  useEffect((): (() => void) => {
    isMounted.current = true
    return () => {
      isMounted.current = false
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

  const setAnchorEl = useCallback(
    (anchorEl: Element | null | undefined) => {
      setState(state => ({
        ...state,
        setAnchorElUsed: true,
        anchorEl: anchorEl ?? undefined,
      }))
    },
    [setState],
  )

  const toggle = useEvent(
    (eventOrAnchorEl?: SyntheticEvent | Element | null) => {
      if (state.isOpen) {
        close(eventOrAnchorEl)
      } else {
        open(eventOrAnchorEl)
      }
      return state
    },
  )

  const open = useEvent((eventOrAnchorEl?: SyntheticEvent | Element | null) => {
    const event =
      eventOrAnchorEl instanceof Element ? undefined : eventOrAnchorEl
    const element =
      eventOrAnchorEl instanceof Element
        ? eventOrAnchorEl
        : eventOrAnchorEl?.currentTarget instanceof Element
          ? eventOrAnchorEl.currentTarget
          : undefined

    if (event?.type === 'touchstart') {
      setState(state => ({ ...state, _deferNextOpen: true }))
      return
    }

    const clientX = (event as MouseEvent | undefined)?.clientX
    const clientY = (event as MouseEvent | undefined)?.clientY
    const anchorPosition =
      typeof clientX === 'number' && typeof clientY === 'number'
        ? { left: clientX, top: clientY }
        : undefined

    const doOpen = (state: CoreState): CoreState => {
      if (parentPopupState) {
        if (!parentPopupState.isOpen) {
          return state
        }
        // Close any other popups at the current level before opening this one
        const currentChildPopupState = parentPopupState._childPopupState
        if (
          currentChildPopupState &&
          currentChildPopupState.popupId !== popupState.popupId
        ) {
          currentChildPopupState.close()
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
    }

    setState((state: CoreState): CoreState => {
      if (state._deferNextOpen) {
        setTimeout(() => {
          setState(doOpen)
        }, 0)
        return { ...state, _deferNextOpen: false }
      } else {
        return doOpen(state)
      }
    })
  })

  const doClose = (state: CoreState): CoreState => {
    const { _childPopupState } = state
    setTimeout(() => {
      _childPopupState?.close()
      parentPopupState?._setChildPopupState(null)
    })
    return { ...state, isOpen: false, hovered: false, focused: false }
  }

  const close = useEvent(
    (eventOrAnchorEl?: SyntheticEvent | Element | null) => {
      const event =
        eventOrAnchorEl instanceof Element ? undefined : eventOrAnchorEl

      if (event?.type === 'touchstart') {
        setState(state => ({ ...state, _deferNextClose: true }))
        return
      }

      setState((state: CoreState): CoreState => {
        if (state._deferNextClose) {
          setTimeout(() => {
            setState(doClose)
          }, 0)
          return { ...state, _deferNextClose: false }
        } else {
          return doClose(state)
        }
      })
    },
  )

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
    [open, close],
  )

  const onMouseLeave = useEvent((_event: MouseEvent) => {
    // changed to do nothing compared to material-ui-popup-state
  })

  const onBlur = useEvent((_event?: FocusEvent) => {
    // changed to do nothing compared to material-ui-popup-state
  })

  const _setChildPopupState = useCallback(
    (_childPopupState: PopupState | null | undefined) => {
      setState(state => ({ ...state, _childPopupState }))
    },
    [setState],
  )

  const popupState: PopupState = {
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
    disableAutoFocus:
      disableAutoFocus ?? Boolean(state.hovered || state.focused),
    _setChildPopupState,
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
