import { useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'

const useStyles = makeStyles()(theme => ({
  chip: {
    position: 'absolute',
    left: 0,
    zIndex: 100,
    padding: '1px 6px',
    fontSize: 11,
    lineHeight: '15px',
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
    <div
      className={warning ? cx(classes.chip, classes.warning) : classes.chip}
      style={{ top, maxWidth }}
      data-testid={testId}
      title={hint.title}
      onClick={() => {
        setDismissed(true)
      }}
    >
      {hint.text}
    </div>
  ) : null
}
