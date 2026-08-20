import { useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'

const useStyles = makeStyles()(theme => ({
  chip: {
    position: 'absolute',
    left: 0,
    zIndex: 100,
    padding: '1px 6px',
    borderBottomRightRadius: 4,
    color: theme.palette.text.secondary,
    background: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderTop: 'none',
    borderLeft: 'none',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    cursor: 'pointer',
    // a real button, so the chip is reachable by Tab and dismissable by Enter
    // or Space — as a div with onClick it could only be got rid of by mouse.
    // `font` before the two that refine it: the shorthand resets both
    font: 'inherit',
    fontSize: 11,
    lineHeight: '15px',
    textAlign: 'left',
    display: 'block',
    // the dismiss affordance. Drawn rather than a child so the chip's text
    // content stays the message, and the whole chip is the hit target anyway —
    // a 7px glyph would be a worse one than the thing it sits on
    '&::after': {
      content: '" ✕"',
      opacity: 0.6,
    },
    '&:hover': {
      background: theme.palette.action.hover,
    },
    '&:hover::after': {
      opacity: 1,
    },
    // click-to-dismiss, and `TreeSidebar` portals this into the track overlay
    // node, which is pointer-events:none so it doesn't eat canvas events
    pointerEvents: 'auto',
  },
  warning: {
    color: theme.palette.warning.dark,
    borderColor: theme.palette.warning.main,
  },
}))

/**
 * The chip `StaleTreeHint` and `ClusterProvenanceHint` both draw: a line of
 * text tucked into the top-left of the tree gutter, over the first row's label.
 *
 * One component rather than two copies because the two share a gutter — a
 * padding or a z-index that drifts between them is visible as a step in the
 * same corner — and because dismissal has to behave identically: neither is a
 * notification, both describe a condition that still holds, so clicking hides
 * this mount and nothing more.
 *
 * Getting rid of it is the one thing this has to be good at, since it sits over
 * a row's own label: the whole chip is the button, it carries a ✕ so that reads
 * as true before you hover it, and it is in the tab order for anyone not
 * reaching for a mouse.
 *
 * `hint` undefined is the nothing-to-say state, and the chip stays mounted
 * through it, so a dismissal survives the condition going away and coming back.
 * Passing an object rather than children keeps that state one prop rather than
 * a `shown` flag the caller can contradict.
 */
export function SidebarHintChip({
  hint,
  top = 0,
  maxWidth,
  warning = false,
  testId,
}: {
  hint?: { title: string; text: string }
  top?: number
  maxWidth?: number
  warning?: boolean
  testId: string
}) {
  const { classes, cx } = useStyles()
  const [dismissed, setDismissed] = useState(false)
  return hint && !dismissed ? (
    <button
      type="button"
      className={warning ? cx(classes.chip, classes.warning) : classes.chip}
      style={{ top, maxWidth }}
      data-testid={testId}
      title={hint.title}
      onClick={() => {
        setDismissed(true)
      }}
    >
      {hint.text}
    </button>
  ) : null
}
