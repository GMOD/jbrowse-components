import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import { observer } from 'mobx-react'

import type { LinearComparativeViewModel } from '../model.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// Track selectors for each synteny level (between adjacent rows) and each
// individual genome row. Shown flat for a two-genome view, grouped into
// submenus once there are more rows.
function getTrackSelectorMenuItems(
  model: LinearComparativeViewModel,
): MenuItem[] {
  const { views } = model
  const syntenySelectors = views.slice(0, -1).map((view, idx) => ({
    label: `Row ${idx + 1} → ${idx + 2} (${view.assemblyNames.join(',')} → ${views[idx + 1]!.assemblyNames.join(',')})`,
    onClick: () => {
      model.activateTrackSelector(idx)
    },
  }))
  const rowSelectors = views.map((view, idx) => ({
    label: `Row ${idx + 1} track selector (${view.assemblyNames.join(',')})`,
    onClick: () => {
      view.activateTrackSelector()
    },
  }))
  return views.length <= 2
    ? [...syntenySelectors, ...rowSelectors]
    : [
        {
          label: 'Synteny track selectors',
          type: 'subMenu',
          subMenu: syntenySelectors,
        },
        {
          label: 'Row track selectors',
          type: 'subMenu',
          subMenu: rowSelectors,
        },
      ]
}

const TrackSelectorMenuButton = observer(function TrackSelectorMenuButton({
  model,
}: {
  model: LinearComparativeViewModel
}) {
  return (
    <CascadingMenuButton
      tooltip="Open track selectors"
      menuItems={() => getTrackSelectorMenuItems(model)}
    >
      <TrackSelectorIcon />
    </CascadingMenuButton>
  )
})

export default TrackSelectorMenuButton
