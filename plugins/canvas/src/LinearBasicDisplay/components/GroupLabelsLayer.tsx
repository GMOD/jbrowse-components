import { GroupLabelChips } from '@jbrowse/display-kit/GroupLabelChips'
import { moveSectionOnto } from '@jbrowse/display-kit/groupByMenu'
import { observer } from 'mobx-react'

import type { FeatureFacet, FeatureGroupSection } from '../facet.ts'

export interface GroupLabelsModel {
  showsGroupLabels: boolean
  groupSections: FeatureGroupSection[]
  scrollTop: number
  height: number
  hiddenGroups: { size: number }
  facet: FeatureFacet | undefined
  setFacet: (facet?: FeatureFacet) => void
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
  const { facet } = model
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
      onMove={
        facet
          ? (key, ontoKey) => {
              moveSectionOnto(
                {
                  sections: groupSections,
                  domain: facet.domain,
                  setDomain: domain => {
                    model.setFacet({ field: facet.field, domain })
                  },
                },
                key,
                ontoKey,
              )
            }
          : undefined
      }
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
