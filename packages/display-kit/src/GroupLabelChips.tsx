import { Fragment } from 'react'

import { OVERFLOW_GROUP_KEY } from '@jbrowse/core/util/groupKeys'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { observer } from 'mobx-react'

import HideGlyph from './HideGlyph.tsx'
import { moveSectionOnto } from './groupByMenu.ts'
import { useGroupLabelStyles } from './groupLabelChipStyles.ts'
import {
  groupChipTops,
  groupSectionLabel,
  sectionKey,
} from './groupLabelStyle.ts'
import { sectionSortOf } from './sectionHost.ts'
import { useSectionDrag } from './useSectionDrag.ts'

import type { SectionHost } from './sectionHost.ts'
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
 * chip on screen carries the way back from any hidden sections, after the
 * caller's `leading` chips: whatever heads the whole stack. With no chip on
 * screen, that way back stands alone at the top. Sections shorter
 * than a chip label every nth (`groupChipTops`).
 *
 * A `host` wires the rest: its hidden count and "Show all", a drag that
 * rewrites its facet's `sort`, and a hide × on each chip while more than one
 * section draws, the overflow section's aside, since it names no value.
 */
export const GroupLabelChips = observer(function GroupLabelChips({
  sections,
  canvasHeight,
  hiddenCount = 0,
  onShowHidden,
  onMove,
  leading,
  host,
}: {
  sections: readonly GroupChipSection[]
  canvasHeight: number
  hiddenCount?: number
  onShowHidden?: () => void
  onMove?: (key: string, ontoKey: string) => void
  leading?: React.ReactNode
  host?: SectionHost
}) {
  const { classes, cx } = useGroupLabelStyles()
  const order = host && sectionSortOf(host)
  const move = order
    ? (key: string, ontoKey: string) => {
        moveSectionOnto({ sections, ...order }, key, ontoKey)
      }
    : onMove
  const hideOf = (key: string) =>
    host && sections.length > 1 && key !== OVERFLOW_GROUP_KEY
      ? () => {
          host.hideGroup(key)
        }
      : undefined
  const hidden = host ? host.hiddenGroups.size : hiddenCount
  const showHidden = host
    ? () => {
        host.showAllGroups()
      }
    : onShowHidden
  const drag = useSectionDrag(sections, sections.length > 1 ? move : undefined)
  const chipTops = groupChipTops(sections, canvasHeight)
  const topmost = chipTops.findIndex(t => t !== undefined)
  const dropLine = drag.dropLineTop
  const restore =
    hidden > 0 && showHidden ? (
      <button
        type="button"
        className={classes.pillButton}
        onClick={showHidden}
        title={`Show ${hidden} hidden group${hidden > 1 ? 's' : ''}`}
      >
        Show {hidden} hidden
      </button>
    ) : null
  return (
    <>
      {topmost === -1 && restore ? (
        <div
          className={classes.controls}
          style={{ top: 1 }}
          data-testid="group-label-chip"
        >
          {leading}
          {restore}
        </div>
      ) : null}
      {dropLine !== undefined ? (
        <div
          className={classes.dropLine}
          style={{ top: Math.max(0, Math.min(dropLine, canvasHeight - 2)) }}
          data-testid="group-drop-line"
        />
      ) : null}
      {sections.map((section, i) => {
        const { top, toggle, action } = section
        const onHide = section.onHide ?? hideOf(section.key)
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
              {i === topmost ? leading : null}
              <div
                className={cx(
                  classes.pill,
                  drag.enabled && classes.draggable,
                  drag.draggingKey === section.key && classes.dragging,
                )}
                {...drag.handlers(section.key)}
              >
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
                    <HideGlyph className={classes.hideIcon} />
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
              {i === topmost ? restore : null}
            </div>
          </Fragment>
        )
      })}
    </>
  )
})
