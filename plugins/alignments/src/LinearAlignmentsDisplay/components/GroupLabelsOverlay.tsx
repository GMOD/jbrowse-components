import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import type { LinearAlignmentsDisplayModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  divider: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    background: theme.palette.divider,
    pointerEvents: 'none',
    zIndex: 6,
  },
  label: {
    position: 'absolute',
    left: 4,
    padding: '0 4px',
    fontSize: 11,
    lineHeight: '14px',
    color: theme.palette.text.secondary,
    background: theme.palette.background.paper,
    opacity: 0.85,
    borderRadius: 3,
    whiteSpace: 'nowrap',
    zIndex: 6,
    cursor: 'pointer',
    border: 'none',
    userSelect: 'none',
    '&:hover': {
      opacity: 1,
    },
  },
}))

// Count of laid-out reads in a group across its visible regions — shown in the
// section label so each group's depth is legible at a glance.
function groupReadCount(map: {
  values(): IterableIterator<{ readIds: string[] }>
}) {
  let n = 0
  for (const data of map.values()) {
    n += data.readIds.length
  }
  return n
}

// Inline section dividers + labels between stacked groups (in-track group-by).
// Only rendered when grouping is active; ungrouped displays show nothing. The
// labels sit at each section's scrolled coverage-band top, so they scroll with
// the stack like the coverage they head.
const GroupLabelsOverlay = observer(function GroupLabelsOverlay({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const { classes } = useStyles()
  if (!model.isGrouped) {
    return null
  }
  const { scrollTop, height } = model
  return (
    <>
      {model.renderSections.map((section, i) => {
        const top = section.coverageTop - scrollTop
        if (top + section.coverageHeight < 0 || top > height) {
          return null
        }
        const count = groupReadCount(section.laidOutPileupMap)
        const collapsed = model.isGroupCollapsed(section.groupKey)
        return (
          <div key={section.groupKey}>
            {i > 0 ? <div className={classes.divider} style={{ top }} /> : null}
            <button
              type="button"
              className={classes.label}
              style={{ top: Math.max(0, top) + 1 }}
              onClick={() => {
                model.toggleGroupCollapsed(section.groupKey)
              }}
              title={collapsed ? 'Expand group' : 'Collapse group'}
            >
              {`${collapsed ? '▸' : '▾'} ${section.label || 'ungrouped'} (${count})`}
            </button>
          </div>
        )
      })}
    </>
  )
})

export default GroupLabelsOverlay
