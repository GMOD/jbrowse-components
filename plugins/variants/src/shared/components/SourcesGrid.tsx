import { useState } from 'react'

import SourcesDataGrid from './SourcesDataGrid.tsx'
import SourcesGridHeader from './SourcesGridHeader.tsx'

import type { Source } from '../types.ts'
import type { GridRowId } from '@mui/x-data-grid'

function SourcesGrid({
  rows,
  onChange,
  showTips,
}: {
  rows: Source[]
  onChange: (arg: Source[]) => void
  showTips: boolean
}) {
  const [selected, setSelected] = useState([] as GridRowId[])

  return (
    <div>
      <SourcesGridHeader
        selected={selected}
        rows={rows}
        showTips={showTips}
        onChange={onChange}
      />
      {rows.length ? (
        <SourcesDataGrid
          rows={rows}
          onChange={onChange}
          setSelected={setSelected}
        />
      ) : (
        <div>No rows</div>
      )}
    </div>
  )
}

export default SourcesGrid
