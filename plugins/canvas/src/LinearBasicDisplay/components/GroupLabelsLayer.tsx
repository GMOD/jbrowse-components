import { GroupLabelChips } from '@jbrowse/display-kit/GroupLabelChips'
import { observer } from 'mobx-react'

import type { FeatureGroupSection } from '../facet.ts'

export interface GroupLabelsModel {
  showsGroupLabels: boolean
  groupSections: FeatureGroupSection[]
  scrollTop: number
  height: number
  hiddenGroups: { size: number }
  hideGroup: (key: string) => void
  showAllGroups: () => void
}

// The whole stack scrolls as one, so a section's screen top is its content
// top less the scroll. Hiding the last section left would leave no chip to
// carry the restore button.
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
      hiddenCount={model.hiddenGroups.size}
      onShowHidden={() => {
        model.showAllGroups()
      }}
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
