import { Fragment } from 'react'

import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import CloseIcon from '@mui/icons-material/Close'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

import { useGroupLabelStyles } from './groupLabelChipStyles.ts'
import {
  groupChipTop,
  groupSectionLabel,
  sectionKey,
} from './groupLabelStyle.ts'

import type React from 'react'

/**
 * One stacked section as the chip row draws it: where it sits on screen, and
 * whichever affordances the display gives its chip. A section with none is a
 * plain label.
 */
export interface GroupChipSection {
  key: string
  label: string
  // Screen px: the caller has already applied its own scroll model.
  top: number
  height: number
  // The chip itself becomes a button carrying a chevron for this state.
  toggle?: { collapsed: boolean; title: string; onClick: () => void }
  // A second button beside the name.
  action?: {
    Icon: React.ElementType<{ className?: string }>
    title: string
    text?: string
    onClick: () => void
  }
  // Draws a hide × inside the chip; absent, the section cannot be hidden.
  onHide?: () => void
}

/**
 * The section chips and the dividers between sections, in screen space, for
 * every display that stacks groups in one track. A chip pins to the canvas top
 * while its section scrolls past (`groupChipTop`, which the SVG twin shares),
 * and a divider marks each section's top edge after the first. The topmost
 * chip on screen carries the way back from any hidden sections.
 */
export function GroupLabelChips({
  sections,
  canvasHeight,
  hiddenCount = 0,
  onShowHidden,
}: {
  sections: readonly GroupChipSection[]
  canvasHeight: number
  hiddenCount?: number
  onShowHidden?: () => void
}) {
  const { classes } = useGroupLabelStyles()
  const chipTops = sections.map(s =>
    groupChipTop(s.top, s.height, canvasHeight),
  )
  const topmost = chipTops.findIndex(t => t !== undefined)
  return (
    <>
      {sections.map((section, i) => {
        const { top, toggle, action, onHide } = section
        const chipTop = chipTops[i]
        if (chipTop === undefined) {
          return null
        }
        const label = groupSectionLabel(section.label)
        return (
          <Fragment key={sectionKey(section.key)}>
            {i > 0 && top >= 0 && top <= canvasHeight ? (
              <div
                className={classes.divider}
                style={{ top }}
                data-testid="group-divider"
              />
            ) : null}
            <div
              className={classes.controls}
              style={{ top: chipTop + 1 }}
              data-testid="group-label-chip"
            >
              <div className={classes.pill}>
                {toggle ? (
                  <button
                    type="button"
                    className={classes.toggle}
                    onClick={toggle.onClick}
                    title={toggle.title}
                  >
                    {toggle.collapsed ? (
                      <ChevronRightIcon className={classes.icon} />
                    ) : (
                      <ExpandMoreIcon className={classes.icon} />
                    )}
                    <span data-testid="group-label-text">{label}</span>
                  </button>
                ) : (
                  <span data-testid="group-label-text">{label}</span>
                )}
                {onHide ? (
                  <button
                    type="button"
                    className={classes.hide}
                    onClick={onHide}
                    title={`Hide "${label}"`}
                  >
                    <CloseIcon className={classes.hideIcon} />
                  </button>
                ) : null}
              </div>
              {action ? (
                <button
                  type="button"
                  className={classes.pillButton}
                  onClick={action.onClick}
                  title={action.title}
                >
                  <action.Icon className={classes.icon} />
                  {action.text}
                </button>
              ) : null}
              {i === topmost && hiddenCount > 0 && onShowHidden ? (
                <button
                  type="button"
                  className={classes.pillButton}
                  onClick={onShowHidden}
                  title={`Show ${hiddenCount} hidden group${hiddenCount > 1 ? 's' : ''}`}
                >
                  Show {hiddenCount} hidden
                </button>
              ) : null}
            </div>
          </Fragment>
        )
      })}
    </>
  )
}
