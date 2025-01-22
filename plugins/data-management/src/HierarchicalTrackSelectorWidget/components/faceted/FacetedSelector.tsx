import { ResizeHandle } from '@jbrowse/core/ui'
import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import FacetFilters from './FacetFilters'
import FacetedDataGrid from './FacetedDataGrid'
import FacetedHeader from './FacetedHeader'
import TrackLabelMenu from '../tree/TrackLabelMenu'

import type { HierarchicalTrackSelectorModel } from '../../model'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { GridColDef } from '@mui/x-data-grid'

export interface InfoArgs {
  target: HTMLElement
  id: string
  conf: AnyConfigurationModel
}

const useStyles = makeStyles()({
  cell: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  resizeHandle: {
    marginLeft: 5,
    background: 'grey',
    width: 5,
  },
})

const frac = 0.75

const FacetedSelector = observer(function FacetedSelector({
  model,
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const { classes } = useStyles()
  const { selection, shownTrackIds, faceted } = model
  const {
    rows,
    panelWidth,
    showFilters,
    filteredRows,
    filteredNonMetadataKeys,
    filteredMetadataKeys,
  } = faceted

  type T = GridColDef<(typeof filteredRows)[0]>

  const columns: T[] = [
    {
      field: 'name',
      hideable: false,
      renderCell: params => {
        const { value, row } = params
        const { id, conf } = row
        return (
          <div className={classes.cell}>
            <SanitizedHTML html={value as string} />
            <TrackLabelMenu id={id} conf={conf} trackId={id} model={model} />
          </div>
        )
      },
    },
    ...filteredNonMetadataKeys.map(e => {
      return {
        field: e,
        renderCell: params => {
          const val = params.value
          return val ? (
            <SanitizedHTML className={classes.cell} html={val} />
          ) : (
            ''
          )
        },
      } satisfies T
    }),
    ...filteredMetadataKeys.map(e => {
      return {
        field: `metadata.${e}`,
        headerName: ['name', ...filteredNonMetadataKeys].includes(e)
          ? `${e} (from metadata)`
          : e,
        valueGetter: (_, row) => `${row.metadata[e] ?? ''}`,
        renderCell: params => {
          const val = params.value
          return val ? (
            <SanitizedHTML className={classes.cell} html={val} />
          ) : (
            ''
          )
        },
      } satisfies T
    }),
  ]

  return (
    <>
      <FacetedHeader model={model} />
      <div
        style={{
          display: 'flex',
          overflow: 'hidden',
          height: window.innerHeight * frac,
          width: window.innerWidth * frac,
        }}
      >
        <div
          style={{
            height: window.innerHeight * frac,
            width: window.innerWidth * frac - (showFilters ? panelWidth : 0),
          }}
        >
          <FacetedDataGrid
            model={model}
            columns={columns}
            shownTrackIds={shownTrackIds}
            selection={selection}
          />
        </div>

        {showFilters ? (
          <>
            <ResizeHandle
              vertical
              onDrag={dist => faceted.setPanelWidth(panelWidth - dist)}
              className={classes.resizeHandle}
            />
            <div style={{ width: panelWidth, overflow: 'auto' }}>
              <FacetFilters model={model} rows={rows} columns={columns} />
            </div>
          </>
        ) : null}
      </div>
    </>
  )
})

export default FacetedSelector
