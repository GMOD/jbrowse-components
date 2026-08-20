import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import { observer } from 'mobx-react'

import { rowLabels } from '../rowLabel.ts'

import type { LinearComparativeViewModel } from '../model.ts'
import type { MenuItem } from '@jbrowse/core/ui'

interface TrackSelectorModel {
  views: {
    assemblyNames: string[]
    activateTrackSelector: () => void
  }[]
  activateTrackSelector: (level: number) => void
}

/**
 * A track selector per synteny level (between adjacent rows) and one per genome
 * row, under two subheaders.
 *
 * FLAT AT EVERY ROW COUNT. Grouping into submenus past two rows meant the
 * labels had to carry their own group ("Row 2 track selector (mm39)") to stay
 * legible in the flat case, which is the wording a genome row already has —
 * `rowLabels`. Naming each row once, under a heading, is shorter than the
 * submenu version at every size and is one shape rather than two.
 */
export function getTrackSelectorMenuItems(
  model: TrackSelectorModel,
): MenuItem[] {
  const { views } = model
  const labels = rowLabels(views)
  return [
    ...(views.length > 1
      ? [
          { type: 'subHeader' as const, label: 'Synteny tracks' },
          ...labels.slice(0, -1).map((label, idx) => ({
            label: `${label} → ${labels[idx + 1]!}`,
            onClick: () => {
              model.activateTrackSelector(idx)
            },
          })),
        ]
      : []),
    { type: 'subHeader' as const, label: 'Genome row tracks' },
    ...labels.map((label, idx) => ({
      label,
      onClick: () => {
        views[idx]!.activateTrackSelector()
      },
    })),
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
