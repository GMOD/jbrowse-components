import { createPortal } from 'react-dom'

import Tooltip from '../tooltip/Tooltip.tsx'
import { useTrackControlMenu } from './useTrackControlMenu.tsx'

import type { TrackControlIcon, TrackControlProps } from './types.ts'

// A dependency-free `TrackControlComponent`, the corner-control counterpart of
// `plainChromeOverlays`: no theme provider to mount, no emotion injected into
// the host page, and nothing that reads as a stray Material widget inside
// someone else's design system. Install it with `TrackControlProvider` (or just
// mount `DisplayUIProvider`) and a stock feature or alignments display stops
// rendering Material UI in its corner.
//
// Deliberately plain rather than pretty. Colors come from `currentColor` and the
// CSS system colors (`Canvas`/`CanvasText`), so the host's own cascade drives
// them and light/dark tracks the host with no theme object.
//
// **The behaviour is not in here.** Dismissal, focus, the top layer and the
// anchoring maths are `useTrackControlMenu`, so writing your own control means
// writing markup rather than re-deriving why the menu opens upward. This file is
// what is left once that is factored out, which is the size it should be.

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

// The ▾ after a label whose press opens a menu. Drawn like the icons, for the
// same reason; smaller, because it qualifies the label rather than naming it.
function Caret() {
  return (
    <svg
      viewBox="0 0 8 8"
      width={8}
      height={8}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: 'none', marginLeft: -1 }}
    >
      <path d="M1.5 3l2.5 2.5L6.5 3" />
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
 * #api
 * A display's ambient bottom-right control — track sizing, the isoform notice,
 * the show-only badge — drawn with no UI toolkit, the corner-control
 * counterpart of `plainChromeOverlays`.
 *
 * `DisplayUIProvider` installs this by default. The behaviour is not in here:
 * dismissal, the keyboard, focus, the top layer and the anchoring are
 * `useTrackControlMenu`, so writing your own control means writing markup
 * rather than re-deriving why the menu opens upward.
 *
 * The package exports it as `plainTrackControl`, lower-cased to match
 * `plainChromeOverlays` — the two are a pair, and both are things you hand to a
 * provider rather than render yourself.
 */
export default function PlainTrackControl({
  icon,
  tooltip,
  label,
  options,
  onClick,
  onMenuClose,
  onDelete,
  warning,
}: TrackControlProps) {
  const { open, triggerProps, menuProps, getOptionProps } =
    useTrackControlMenu(onMenuClose)

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      <Tooltip title={tooltip}>
        <button
          type="button"
          aria-label={tooltip}
          // same handle as the Material set's trigger — see MuiTrackControl.
          // The string is repeated rather than imported, because importing
          // anything from that module would drag Material UI back into this
          // one, which is the whole point of this file.
          data-testid={`track-control-${icon}`}
          {...(options ? triggerProps : undefined)}
          style={{
            ...triggerStyle(!!warning),
            // the (×) butts straight up against this one, so they read as a
            // single control rather than two
            borderRadius: onDelete ? '3px 0 0 3px' : 3,
          }}
          // `options` and `onClick` are mutually exclusive, so this replaces
          // the spread handler rather than composing with it. Both stop the
          // click reaching the track/view (drag-select, deselect).
          onClick={
            options
              ? triggerProps.onClick
              : event => {
                  event.stopPropagation()
                  onClick?.()
                }
          }
        >
          <Icon icon={icon} />
          {label}
          {label !== undefined && options ? <Caret /> : null}
        </button>
      </Tooltip>
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
      {open && options
        ? createPortal(
            <div
              {...menuProps}
              style={{
                ...menuProps.style,
                zIndex: 2147483647,
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
                  {...getOptionProps(option)}
                  style={{
                    display: 'block',
                    width: '100%',
                    font: 'inherit',
                    textAlign: 'left',
                    padding: '3px 10px 3px 20px',
                    whiteSpace: 'nowrap',
                    // the check mark lives in the padding, so selecting an
                    // option can't reflow the list
                    textIndent: option.selected ? '-12px' : 0,
                    cursor: 'pointer',
                    color: 'inherit',
                    background: 'transparent',
                    border: 'none',
                  }}
                >
                  {option.selected ? '✓ ' : ''}
                  {option.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </span>
  )
}
