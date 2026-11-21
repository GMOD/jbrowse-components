import { getSession } from '@jbrowse/core/util/mstUtils'
import { observer } from 'mobx-react'

import HideGlyph from './HideGlyph.tsx'
import { useGroupLabelStyles } from './groupLabelChipStyles.ts'
import { GROUP_LABEL_INSET_X } from './groupLabelStyle.ts'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type React from 'react'

/**
 * Whether the viewer wants band chips drawn on screen, the `showBandChips`
 * preference. An SVG export titles its bands either way.
 */
export function bandChipsShown(node: IAnyStateTreeNode) {
  return getSession(node).getPreference('showBandChips') !== false
}

/**
 * A row of chips laid over the top-left of the band they name, in the
 * section chips' vocabulary. It reserves no height: the chips cover the
 * band's first marks.
 */
export const BandChipRow = observer(function BandChipRow({
  top,
  left = GROUP_LABEL_INSET_X,
  testid,
  children,
}: {
  top: number
  left?: number
  testid?: string
  children: React.ReactNode
}) {
  const { classes } = useGroupLabelStyles()
  return (
    <div
      className={classes.controls}
      style={{ top, left }}
      data-testid={testid}
    >
      {children}
    </div>
  )
})

/** One band's name, with a × that hides the band. */
export const BandChip = observer(function BandChip({
  label,
  onHide,
}: {
  label: string
  onHide: () => void
}) {
  const { classes } = useGroupLabelStyles()
  return (
    <div className={classes.pill} data-testid={`band_chip_${label}`}>
      {label}
      <button
        type="button"
        className={classes.hide}
        title={`Hide ${label.toLowerCase()}`}
        onClick={() => {
          onHide()
        }}
      >
        <HideGlyph className={classes.hideIcon} />
      </button>
    </div>
  )
})

/** A chip that is itself a button, such as a way back to a hidden band. */
export const BandChipButton = observer(function BandChipButton({
  testid,
  title,
  text,
  onClick,
}: {
  testid: string
  title: string
  text: string
  onClick: () => void
}) {
  const { classes } = useGroupLabelStyles()
  return (
    <button
      type="button"
      data-testid={testid}
      className={classes.pillButton}
      title={title}
      onClick={() => {
        onClick()
      }}
    >
      {text}
    </button>
  )
})
