import { observer } from 'mobx-react'

import TrackTableGrid from '../../TrackTable/components/TrackTableGrid.tsx'
import { shownFields } from '../../TrackTable/components/tableLayout.ts'

import type { HierarchicalTrackSelectorModel } from '../model.ts'

const TrackTable = observer(function TrackTable({
  model,
  width,
}: {
  model: HierarchicalTrackSelectorModel
  width: number
}) {
  const table = model.trackTable
  return (
    <TrackTableGrid
      model={model}
      table={table}
      fields={shownFields(table, width)}
      width={width}
      emptyMessage={model.emptyListMessage}
    />
  )
})

export default TrackTable
