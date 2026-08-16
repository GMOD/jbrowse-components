import { useCallback, useEffect, useRef, useState } from 'react'

import type { TrackControlOption } from './types.ts'
import type { CSSProperties } from 'react'

// The behaviour behind a bottom-right control's menu, with none of its
// appearance — prop getters to spread, the way a headless UI library hands one
// over. `plainTrackControl` is a thin markup layer over this, and a host writing
// their own control gets the parts that are actually hard:
//
//   - **the top layer.** A display's tree is sealed in a `contain: strict` box
//     (and an embedder's track row usually adds another), so a menu positioned
//     against the trigger is clipped by the track it belongs to — and these
//     controls sit on the very bottom edge, the worst case for it. The caller
//     portals, because `createPortal` is theirs to aim; the anchoring maths is
//     here.
//   - **the anchor.** Bottom-to-top and right-to-right, so the menu opens upward
//     without anyone measuring its height first, and does not run off the right
//     edge of the window — where the browser reflows it into a sliver and every
//     label wraps.
//   - **dismissal.** Escape, a pointer press outside, and any ancestor
//     scrolling. Each is a bug when missed, and none of them shows up in a
//     screenshot.
//
// `style` on `menuProps` carries **position only**. Sizing, colour and border
// are the caller's, and merging is `{...menuProps.style, ...yours}`.

export interface TrackControlMenu {
  /** Whether the menu is up. The caller renders `menuProps` only when true. */
  open: boolean
  close: () => void
  /**
   * Spread onto the button that opens the menu. `data-state` is a styling hook
   * — a host's stylesheet can reach `[data-state='open']` without this having to
   * take a `className` for every part.
   */
  triggerProps: {
    'aria-expanded': boolean
    'aria-haspopup': 'menu'
    'data-state': 'open' | 'closed'
    onClick: (event: React.MouseEvent<HTMLElement>) => void
  }
  /** Spread onto the menu container — portal it to `document.body`. */
  menuProps: {
    ref: React.Ref<HTMLDivElement>
    role: 'menu'
    tabIndex: -1
    style: CSSProperties
  }
  /** Spread onto each option. Selecting closes and returns focus to the trigger. */
  getOptionProps: (option: TrackControlOption) => {
    role: 'menuitemradio'
    'aria-checked': boolean
    onClick: () => void
  }
}

export function useTrackControlMenu(): TrackControlMenu {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const close = useCallback(() => {
    setAnchor(null)
  }, [])

  useEffect(() => {
    if (!anchor) {
      return
    }
    ref.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close()
        anchor.focus()
      }
    }
    // pointerdown rather than click: the press is what dismisses, and listening
    // for the click would let the same press both close this and re-open it
    // through the trigger underneath
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (
        target instanceof Node &&
        !ref.current?.contains(target) &&
        !anchor.contains(target)
      ) {
        close()
      }
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointerDown, true)
    // The position below is measured off the trigger once, at open time, so
    // anything that moves the trigger afterwards leaves the menu floating
    // somewhere of its own. Close rather than re-measure: the trigger is on a
    // track's bottom edge and a page scroll usually takes it off screen
    // entirely, so a re-measured menu would follow it out of view instead of
    // going away. Capture phase, so a scroll in any ancestor counts and not just
    // one on the document.
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [anchor, close])

  const rect = anchor?.getBoundingClientRect()

  return {
    open: !!anchor,
    close,
    triggerProps: {
      'aria-haspopup': 'menu',
      'aria-expanded': !!anchor,
      'data-state': anchor ? 'open' : 'closed',
      onClick: event => {
        // don't let the click bubble to the track/view (drag-select, deselect)
        event.stopPropagation()
        setAnchor(anchor ? null : event.currentTarget)
      },
    },
    menuProps: {
      ref,
      role: 'menu',
      tabIndex: -1,
      style: rect
        ? {
            position: 'fixed',
            right: Math.max(4, window.innerWidth - rect.right),
            bottom: window.innerHeight - rect.top + 4,
            minWidth: rect.width,
            maxWidth: 'calc(100vw - 8px)',
          }
        : {},
    },
    getOptionProps: option => ({
      role: 'menuitemradio',
      'aria-checked': option.selected,
      onClick: () => {
        option.onSelect()
        close()
        anchor?.focus()
      },
    }),
  }
}
