import { GroupLabelChips } from '@jbrowse/display-kit/GroupLabelChips'
import { groupSectionLabel } from '@jbrowse/display-kit/groupLabelStyle'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import { observer } from 'mobx-react'

import type { FeatureGroupSection } from '../groupBy.ts'

export interface GroupLabelsModel {
  showsGroupLabels: boolean
  groupSections: FeatureGroupSection[]
  collapsedGroupKeys: ReadonlySet<string>
  scrollTop: number
  height: number
  toggleGroupCollapsed: (key: string) => void
  hideGroup: (key: string) => void
}

// The whole stack scrolls as one, so a section's screen top is its content
// top less the scroll. Each chip toggles its section onto one row, and hides
// it while another section would be left to come back from.
const GroupLabelsLayer = observer(function GroupLabelsLayer({
  model,
}: {
  model: GroupLabelsModel
}) {
  if (!model.showsGroupLabels) {
    return null
  }
  const { scrollTop, height, groupSections, collapsedGroupKeys } = model
  const canHide = groupSections.length > 1
  return (
    <GroupLabelChips
      canvasHeight={height}
      sections={groupSections.map(section => {
        const { key, label } = section
        const collapsed = collapsedGroupKeys.has(key)
        return {
          ...section,
          top: section.top - scrollTop,
          toggle: {
            collapsed,
            title: collapsed
              ? 'Expand this group into its own rows'
              : 'Collapse this group to one row',
            onClick: () => {
              model.toggleGroupCollapsed(key)
            },
          },
          menuItems: canHide
            ? [
                {
                  label: `Hide "${groupSectionLabel(label)}"`,
                  icon: VisibilityOffIcon,
                  onClick: () => {
                    model.hideGroup(key)
                  },
                },
              ]
            : undefined,
        }
      })}
    />
  )
})

export default GroupLabelsLayer
