import { GroupLabelChips } from '@jbrowse/display-kit/GroupLabelChips'
import { observer } from 'mobx-react'

import type { FeatureGroupSection } from '../groupBy.ts'

export interface GroupLabelsModel {
  showsGroupLabels: boolean
  groupSections: FeatureGroupSection[]
  scrollTop: number
  height: number
}

// The whole stack scrolls as one, so a section's screen top is its content
// top less the scroll; the chips carry no affordances here.
const GroupLabelsLayer = observer(function GroupLabelsLayer({
  model,
}: {
  model: GroupLabelsModel
}) {
  if (!model.showsGroupLabels) {
    return null
  }
  const { scrollTop, height } = model
  return (
    <GroupLabelChips
      sections={model.groupSections.map(section => ({
        ...section,
        top: section.top - scrollTop,
      }))}
      canvasHeight={height}
    />
  )
})

export default GroupLabelsLayer
