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
//   - **the keyboard.** `role="menu"` is a promise: a screen-reader user who
//     opens one expects Up/Down to walk it and Home/End to reach its ends. The
//     Material control gets that from MUI's `Menu` for free, so a host swapping
//     in a plain one was trading working keyboard operation for a look — the
//     one thing the seam must not cost them.
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
  /**
   * Spread onto each option. Selecting closes and returns focus to the trigger.
   *
   * `role="menuitemradio"` is also how the arrow keys find their targets — the
   * hook queries the container for it rather than collecting refs, so any markup
   * that spreads these props is navigable without handing anything back.
   */
  getOptionProps: (option: TrackControlOption) => {
    role: 'menuitemradio'
    'aria-checked': boolean
    onClick: () => void
  }
}

/**
 * #api
 * The behaviour behind a bottom-right track control's menu, as prop getters to
 * spread — dismissal (Escape, an outside press, an ancestor scrolling), the
 * keyboard (arrows, Home/End), focus, and the anchoring that clears both the
 * display's `contain: strict` box and the window edge.
 *
 * For writing your own control rather than restyling `plainTrackControl`: each
 * of those rules is a bug when missed and none of them shows up in a
 * screenshot. Render `menuProps` only while `open`, and portal it to
 * `document.body` — `createPortal` is the caller's to aim, the maths is here.
 * `menuProps.style` carries position only.
 */
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
    // Found by role rather than by a collected ref: the caller owns the markup,
    // and `getOptionProps` already stamps the role onto every option.
    const items = () => [
      ...(ref.current?.querySelectorAll<HTMLElement>(
        '[role="menuitemradio"]',
      ) ?? []),
    ]
    const moveFocus = (to: number | 'first' | 'last') => {
      const list = items()
      if (list.length === 0) {
        return
      }
      const from = list.indexOf(document.activeElement as HTMLElement)
      const next =
        to === 'first'
          ? 0
          : to === 'last'
            ? list.length - 1
            : from === -1
              ? 0
              : // wraps, which is what a menu of a handful of options wants:
                // the list is short enough that walking off one end and
                // arriving at the other is faster than reversing
                (from + to + list.length) % list.length
      list[next]?.focus()
    }
    // Opening lands on the option already chosen, so the current setting is
    // what a screen reader reads first and one keypress reaches its neighbour.
    // Focusing the container instead announces the menu and none of its
    // contents.
    const list = items()
    ;(
      list.find(el => el.getAttribute('aria-checked') === 'true') ??
      list[0] ??
      ref.current
    )?.focus()

    const moves: Record<string, number | 'first' | 'last'> = {
      ArrowDown: 1,
      ArrowUp: -1,
      Home: 'first',
      End: 'last',
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close()
        anchor.focus()
        return
      }
      const to = moves[event.key]
      if (to !== undefined) {
        // Without this the arrows scroll the page, and a page scroll closes
        // this menu — so every attempt to walk the list would dismiss it.
        event.preventDefault()
        moveFocus(to)
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
