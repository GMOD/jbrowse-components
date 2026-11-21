import { GroupLabelChips } from '@jbrowse/display-kit/GroupLabelChips'
import { observer } from 'mobx-react'

import type { FeatureGroupSection } from '../facet.ts'
import type { SectionHost } from '@jbrowse/display-kit/sectionHost'

export interface GroupLabelsModel extends SectionHost {
  showsGroupLabels: boolean
  groupSections: FeatureGroupSection[]
  scrollTop: number
  height: number
}

// The whole stack scrolls as one, so a section's screen top is its content
// top less the scroll. With every section hidden another way, the restore
// button still draws.
const GroupLabelsLayer = observer(function GroupLabelsLayer({
  model,
}: {
  model: GroupLabelsModel
}) {
  const { scrollTop, height, groupSections } = model
  return model.showsGroupLabels || model.hiddenGroups.size > 0 ? (
    <GroupLabelChips
      host={model}
      canvasHeight={height}
      sections={groupSections.map(section => ({
        ...section,
        top: section.top - scrollTop,
      }))}
    />
  ) : null
})

export default GroupLabelsLayer
