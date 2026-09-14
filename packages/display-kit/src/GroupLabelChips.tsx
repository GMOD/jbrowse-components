import { Fragment, useState } from 'react'

import { ContextMenu } from '@jbrowse/core/ui'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

import { useGroupLabelStyles } from './groupLabelChipStyles.ts'
import {
  groupChipTop,
  groupSectionLabel,
  sectionKey,
} from './groupLabelStyle.ts'

import type { ContextMenuAnchor, MenuItem } from '@jbrowse/core/ui'
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
  // The chip's right-click menu; absent, the chip takes no right-click.
  menuItems?: MenuItem[]
}

/**
 * The section chips and the dividers between sections, in screen space, for
 * every display that stacks groups in one track. A chip pins to the canvas top
 * while its section scrolls past (`groupChipTop`, which the SVG twin shares),
 * and a divider marks each section's top edge after the first.
 */
export function GroupLabelChips({
  sections,
  canvasHeight,
}: {
  sections: readonly GroupChipSection[]
  canvasHeight: number
}) {
  const { classes } = useGroupLabelStyles()
  // The right-click target, held as one value: the click point and the menu it
  // opened cannot disagree, and `undefined` is the closed state.
  const [menu, setMenu] = useState<{
    anchor: ContextMenuAnchor
    items: MenuItem[]
  }>()
  const openMenu = (event: React.MouseEvent, items: MenuItem[]) => {
    event.preventDefault()
    setMenu({
      anchor: { clientX: event.clientX, clientY: event.clientY },
      items,
    })
  }
  return (
    <>
      {sections.map((section, i) => {
        const { top, height, toggle, action, menuItems } = section
        const chipTop = groupChipTop(top, height, canvasHeight)
        if (chipTop === undefined) {
          return null
        }
        const label = groupSectionLabel(section.label)
        const onContextMenu = menuItems
          ? (event: React.MouseEvent) => {
              openMenu(event, menuItems)
            }
          : undefined
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
              {toggle ? (
                <button
                  type="button"
                  className={classes.button}
                  onClick={toggle.onClick}
                  onContextMenu={onContextMenu}
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
                <span
                  className={classes.label}
                  style={{ pointerEvents: menuItems ? 'auto' : 'none' }}
                  data-testid="group-label-text"
                  onContextMenu={onContextMenu}
                >
                  {label}
                </span>
              )}
              {action ? (
                <button
                  type="button"
                  className={classes.button}
                  onClick={action.onClick}
                  title={action.title}
                >
                  <action.Icon className={classes.icon} />
                  {action.text}
                </button>
              ) : null}
            </div>
          </Fragment>
        )
      })}
      <ContextMenu
        anchor={menu?.anchor}
        menuItems={menu?.items ?? []}
        onClose={() => {
          setMenu(undefined)
        }}
      />
    </>
  )
}
