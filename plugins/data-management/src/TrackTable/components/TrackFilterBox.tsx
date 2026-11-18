import ClearableSearchField from '@jbrowse/core/ui/ClearableSearchField'
import { observer } from 'mobx-react'

import type { TrackTableModel } from '../trackTableModel.ts'

const TrackFilterBox = observer(function TrackFilterBox({
  table,
  className,
}: {
  table: TrackTableModel
  className: string
}) {
  const { matchCounts } = table
  return (
    <ClearableSearchField
      className={className}
      label="Filter tracks"
      inputRef={table.setFilterBoxInput}
      value={table.filterText}
      status={
        matchCounts
          ? `${matchCounts.matched} of ${matchCounts.total}`
          : undefined
      }
      onChange={value => {
        table.setFilterText(value)
      }}
    />
  )
})

export default TrackFilterBox
