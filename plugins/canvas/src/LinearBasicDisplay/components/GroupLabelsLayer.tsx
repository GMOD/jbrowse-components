import { GroupLabelChips } from '@jbrowse/display-kit/GroupLabelChips'
import { observer } from 'mobx-react'

import type { FeatureGroupSection } from '../groupBy.ts'

export interface GroupLabelsModel {
  showsGroupLabels: boolean
  groupSections: FeatureGroupSection[]
  scrollTop: number
  height: number
  hideGroup: (key: string) => void
}

// The whole stack scrolls as one, so a section's screen top is its content
// top less the scroll. The last section left offers no hide, since an empty
// track has no chip to come back from.
const GroupLabelsLayer = observer(function GroupLabelsLayer({
  model,
}: {
  model: GroupLabelsModel
}) {
  if (!model.showsGroupLabels) {
    return null
  }
  const { scrollTop, height, groupSections } = model
  const canHide = groupSections.length > 1
  return (
    <GroupLabelChips
      canvasHeight={height}
      sections={groupSections.map(section => ({
        ...section,
        top: section.top - scrollTop,
        onHide: canHide
          ? () => {
              model.hideGroup(section.key)
            }
          : undefined,
      }))}
    />
  )
})

export default GroupLabelsLayer
