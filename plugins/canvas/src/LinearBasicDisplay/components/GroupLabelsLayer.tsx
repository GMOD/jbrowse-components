import { Fragment } from 'react'

import { useGroupLabelStyles } from '@jbrowse/display-kit/groupLabelChipStyles'
import {
  groupChipTop,
  groupSectionLabel,
} from '@jbrowse/display-kit/groupLabelStyle'
import { observer } from 'mobx-react'

import type { FeatureGroupSection } from '../groupBy.ts'

export interface GroupLabelsModel {
  showsGroupLabels: boolean
  groupSections: FeatureGroupSection[]
  scrollTop: number
  height: number
}

// The section chips and the dividers between sections, in screen space:
// the whole stack scrolls as one, so a section's top is its content top less
// the scroll, and the chip pins to the canvas top while its section scrolls
// past (`groupChipTop`, which the export shares).
const GroupLabelsLayer = observer(function GroupLabelsLayer({
  model,
}: {
  model: GroupLabelsModel
}) {
  const { classes } = useGroupLabelStyles()
  if (!model.showsGroupLabels) {
    return null
  }
  const { scrollTop, height } = model
  return (
    <>
      {model.groupSections.map((section, i) => {
        const top = section.top - scrollTop
        const chipTop = groupChipTop(top, section.height, height)
        if (chipTop === undefined) {
          return null
        }
        return (
          <Fragment key={section.key || 'ungrouped'}>
            {i > 0 && top >= 0 && top <= height ? (
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
              <span className={classes.label} data-testid="group-label-text">
                {groupSectionLabel(section.label)}
              </span>
            </div>
          </Fragment>
        )
      })}
    </>
  )
})

export default GroupLabelsLayer
