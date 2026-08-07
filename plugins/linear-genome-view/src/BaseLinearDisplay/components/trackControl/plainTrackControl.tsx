import { useEffect, useRef, useState } from 'react'

import { createPortal } from 'react-dom'

import type { TrackControlIcon, TrackControlProps } from './types.ts'

// A dependency-free `TrackControlComponent`, the corner-control counterpart of
// `plainChromeOverlays`: no theme provider to mount, no emotion injected into
// the host page, and nothing that reads as a stray Material widget inside
// someone else's design system. Install it with `TrackControlProvider` and a
// stock feature or alignments display stops rendering Material UI in its corner.
//
// Deliberately plain rather than pretty. Colors come from `currentColor` and the
// CSS system colors (`Canvas`/`CanvasText`), so the host's own cascade drives
// them and light/dark tracks the host with no theme object. Restyle by wrapping
// this, or write your own against `TrackControlComponent`.

// Icon paths, drawn here rather than imported, because importing an icon set is
// the thing this file exists to avoid. 16x16, stroked so one path serves any
// size and any color.
const ICON_PATHS = {
  // vertical double-headed arrow: make me taller/shorter
  height: 'M8 2.5v11M5 5.5 8 2.5l3 3M5 10.5l3 3 3-3',
  // two chevrons folding onto a line: several things shown as one. The line is
  // load-bearing -- without it the two chevrons read as an ✕ at this size.
  isoform: 'M2.5 8h11M4 4l4 3 4-3M4 12l4-3 4 3',
  // funnel: showing only some of them
  filter: 'M2.5 3.5h11l-4.5 5v4l-2 1.5v-5.5z',
} satisfies Record<TrackControlIcon, string>

// The one literal color in this file. Every other rule reads the host's cascade,
// but "something is wrong here" has no CSS system color to borrow, and the
// warning state exists precisely so the user sees it without hovering. Chosen to
// stay legible on both a light and a dark track.
const WARNING_COLOR = '#d97706'

function Icon({ icon }: { icon: TrackControlIcon }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={12}
      height={12}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: 'none' }}
    >
      <path d={ICON_PATHS[icon]} />
    </svg>
  )
}

function triggerStyle(warning: boolean): React.CSSProperties {
  return {
    font: 'inherit',
    fontSize: '0.7rem',
    lineHeight: 1.4,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '1px 5px',
    cursor: 'pointer',
    color: warning ? WARNING_COLOR : 'CanvasText',
    border: '1px solid',
    borderColor: warning
      ? WARNING_COLOR
      : 'color-mix(in srgb, CanvasText 35%, transparent)',
    borderRadius: 3,
    // Nearly opaque: these sit over a canvas whose colors are not known here,
    // and a translucent chip over dense data was measurably hard to read.
    background: 'color-mix(in srgb, Canvas 94%, transparent)',
  }
}

/**
 * The menu, in the top layer rather than next to its button.
 *
 * A display's tree is sealed in a `contain: strict` box (and an embedder's own
 * track row usually adds another), so a menu positioned relative to the trigger
 * would be clipped by the track it belongs to — these controls sit on the very
 * bottom edge, which is the worst case for it. Portaling to `document.body` and
 * positioning `fixed` off the trigger's measured rect is the dependency-free
 * answer, and it is why no positioning library is needed here.
 *
 * Anchored by its *bottom* to the trigger's top, so it opens upward without
 * anyone having to measure its height first, and by its *right* to the
 * trigger's right, because these controls live in a display's bottom-right
 * corner: left-anchoring put the menu through the right edge of the window,
 * where the browser reflows it into a sliver and every label wraps.
 */
function OptionsMenu({
  anchor,
  options,
  onClose,
}: {
  anchor: HTMLElement
  options: NonNullable<TrackControlProps['options']>
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const rect = anchor.getBoundingClientRect()

  useEffect(() => {
    ref.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
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
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointerDown, true)
    // The `fixed` position below is measured off the trigger once, at open
    // time, so anything that moves the trigger afterwards leaves this menu
    // floating somewhere of its own. Close rather than re-measure: the trigger
    // is on a track's bottom edge and a page scroll usually takes it off screen
    // entirely, so a re-measured menu would follow it out of view instead of
    // going away. Capture phase, so a scroll in any ancestor counts and not
    // just one on the document.
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('resize', onClose)
    }
  }, [anchor, onClose])

  return createPortal(
    <div
      ref={ref}
      role="menu"
      tabIndex={-1}
      style={{
        position: 'fixed',
        right: Math.max(4, window.innerWidth - rect.right),
        bottom: window.innerHeight - rect.top + 4,
        zIndex: 2147483647,
        minWidth: rect.width,
        maxWidth: 'calc(100vw - 8px)',
        padding: '2px 0',
        font: 'inherit',
        fontSize: '0.75rem',
        color: 'CanvasText',
        background: 'Canvas',
        border: '1px solid',
        borderColor: 'color-mix(in srgb, CanvasText 35%, transparent)',
        borderRadius: 4,
      }}
    >
      {options.map(option => (
        <button
          key={option.label}
          type="button"
          role="menuitemradio"
          aria-checked={option.selected}
          style={{
            display: 'block',
            width: '100%',
            font: 'inherit',
            textAlign: 'left',
            padding: '3px 10px 3px 20px',
            whiteSpace: 'nowrap',
            // the check mark lives in the padding, so selecting an option can't
            // reflow the list
            textIndent: option.selected ? '-12px' : 0,
            cursor: 'pointer',
            color: 'inherit',
            background: 'transparent',
            border: 'none',
          }}
          onClick={() => {
            option.onSelect()
            onClose()
            anchor.focus()
          }}
        >
          {option.selected ? '✓ ' : ''}
          {option.label}
        </button>
      ))}
    </div>,
    document.body,
  )
}

export default function PlainTrackControl({
  icon,
  tooltip,
  label,
  options,
  onClick,
  onDelete,
  warning,
}: TrackControlProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        // `title` rather than a custom tooltip: it is the browser's own, it
        // costs nothing, and it is the one piece of this control that a host
        // design system usually does not want to restyle anyway.
        title={tooltip}
        aria-label={tooltip}
        aria-haspopup={options ? 'menu' : undefined}
        aria-expanded={options ? Boolean(anchor) : undefined}
        style={{
          ...triggerStyle(!!warning),
          // the (×) butts straight up against this one, so they read as a
          // single control rather than two
          borderRadius: onDelete ? '3px 0 0 3px' : 3,
        }}
        onClick={event => {
          // don't let the click bubble to the track/view (drag-select, deselect)
          event.stopPropagation()
          if (options) {
            setAnchor(anchor ? null : event.currentTarget)
          } else {
            onClick?.()
          }
        }}
      >
        <Icon icon={icon} />
        {label}
      </button>
      {onDelete ? (
        <button
          type="button"
          aria-label="Dismiss"
          // same handle as the Material set's delete icon — see MuiTrackControl
          data-testid="track-control-dismiss"
          style={{
            ...triggerStyle(!!warning),
            marginLeft: -1,
            padding: '1px 4px',
            borderRadius: '0 3px 3px 0',
          }}
          onClick={event => {
            event.stopPropagation()
            onDelete()
          }}
        >
          ×
        </button>
      ) : null}
      {anchor && options ? (
        <OptionsMenu
          anchor={anchor}
          options={options}
          onClose={() => {
            setAnchor(null)
          }}
        />
      ) : null}
    </span>
  )
}
