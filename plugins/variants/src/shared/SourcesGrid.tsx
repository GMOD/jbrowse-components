import { useState } from 'react'

import SourcesDataGrid from './SourcesDataGrid'
import SourcesGridHeader from './SourcesGridHeader'

import type { Source } from '../types'

function SourcesGrid({
  rows,
  onChange,
  showTips,
}: {
  rows: Source[]
  onChange: (arg: Source[]) => void
  showTips: boolean
}) {
  const [selected, setSelected] = useState([] as string[])

  return (
    <div>
      <SourcesGridHeader
        selected={selected}
        rows={rows}
        showTips={showTips}
        onChange={onChange}
      />
      <SourcesDataGrid
        rows={rows}
        onChange={onChange}
        setSelected={setSelected}
      />
    </div>
  )
}

export default SourcesGrid
