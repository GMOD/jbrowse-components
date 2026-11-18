import ClearableSearchField from '@jbrowse/core/ui/ClearableSearchField'
import { observer } from 'mobx-react'

import type { TrackTableModel } from '../trackTableModel.ts'
import type { Ref } from 'react'

const TrackFilterBox = observer(function TrackFilterBox({
  table,
  className,
  inputRef,
}: {
  table: TrackTableModel
  className: string
  inputRef: Ref<HTMLInputElement>
}) {
  const { matchCounts } = table
  return (
    <ClearableSearchField
      className={className}
      label="Filter tracks"
      inputRef={inputRef}
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
