import { useRef } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import FacetChips from './FacetChips.tsx'
import FolderTableHeader from './FolderTableHeader.tsx'
import TrackTableGrid from './TrackTableGrid.tsx'
import { shownFields } from './tableLayout.ts'
import { useWindowSize } from './useWindowSize.ts'

import type { HierarchicalTrackSelectorModel } from '../../HierarchicalTrackSelectorWidget/model.ts'
import type { TrackTableModel } from '../trackTableModel.ts'

const useStyles = makeStyles()({
  root: {
    display: 'flex',
    flexDirection: 'column',
  },
  grid: {
    flex: 1,
    minHeight: 0,
  },
})

const frac = 0.75

/**
 * a table with its own filter box, for a dialog sized to the window
 */
const FolderTable = observer(function FolderTable({
  model,
  table,
}: {
  model: HierarchicalTrackSelectorModel
  table: TrackTableModel
}) {
  const { classes } = useStyles()
  const filterBoxRef = useRef<HTMLInputElement>(null)
  const windowSize = useWindowSize()
  const width = windowSize.width * frac
  const shown = shownFields(table, width)
  return (
    <div
      className={classes.root}
      style={{ width, height: windowSize.height * frac }}
    >
      <FolderTableHeader
        model={model}
        table={table}
        shown={shown}
        filterBoxRef={filterBoxRef}
      />
      <FacetChips table={table} filterBoxRef={filterBoxRef} />
      <div className={classes.grid}>
        <TrackTableGrid
          model={model}
          table={table}
          fields={shown}
          width={width}
        />
      </div>
    </div>
  )
})

export default FolderTable
