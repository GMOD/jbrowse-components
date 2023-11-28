import React, { useMemo, useState, useEffect } from 'react'
import { IconButton } from '@mui/material'
import { transaction } from 'mobx'
import { observer } from 'mobx-react'
import { getRoot, resolveIdentifier } from 'mobx-state-tree'
import { DataGrid, GridCellParams, GridToolbar } from '@mui/x-data-grid'

// jbrowse
import { ResizeHandle } from '@jbrowse/core/ui'
import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'
import JBrowseMenu from '@jbrowse/core/ui/Menu'
import ResizeBar from '@jbrowse/core/ui/ResizeBar'
import {
  getEnv,
  getSession,
  measureGridWidth,
  useDebounce,
} from '@jbrowse/core/util'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { useResizeBar } from '@jbrowse/core/ui/useResizeBar'
import { makeStyles } from 'tss-react/mui'

// icons
import MoreHoriz from '@mui/icons-material/MoreHoriz'

// locals
import { HierarchicalTrackSelectorModel } from '../../model'
import FacetedHeader from './FacetedHeader'
import FacetFilters from './FacetFilters'
import { getRootKeys } from './util'

const nonMetadataKeys = ['category', 'adapter', 'description'] as const
function filt(
  keys: readonly string[],
  rows: Record<string, unknown>[],
  cb: (row: Record<string, unknown>, f: string) => unknown,
) {
  return keys.filter(f => rows.map(r => cb(r, f)).filter(f => !!f).length > 5)
}

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
})

const frac = 0.75

const FacetedSelector = observer(function FacetedSelector({
  model,
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const { classes } = useStyles()
  const { view, selection, faceted } = model
  const {
    rows,
    panelWidth,
    showSparse,
    showFilters,
    useShoppingCart,
    showOptions,
    filteredRows,
  } = faceted
  const { pluginManager } = getEnv(model)
  const { ref, scrollLeft } = useResizeBar()
  const [info, setInfo] = useState<InfoArgs>()
  const session = getSession(model)
  const tracks = view.tracks as AnyConfigurationModel[]

  const filteredNonMetadataKeys = showSparse
    ? nonMetadataKeys
    : filt(nonMetadataKeys, rows, (r, f) => r[f])

  const metadataKeys = [
    ...new Set(rows.flatMap(row => getRootKeys(row.metadata))),
  ]
  const filteredMetadataKeys = showSparse
    ? metadataKeys
    : // @ts-expect-error
      filt(metadataKeys, rows, (r, f) => r.metadata[f])

  const fields = useMemo(
    () => [
      'name',
      ...filteredNonMetadataKeys,
      ...filteredMetadataKeys.map(m => `m.${m}`),
    ],
    [filteredNonMetadataKeys, filteredMetadataKeys],
  )

  const [widths, setWidths] = useState({
    name:
      measureGridWidth(
        rows.map(r => r.name),
        { maxWidth: 500, stripHTML: true },
      ) + 15,
    ...Object.fromEntries(
      filteredNonMetadataKeys.map(e => [
        e,
        measureGridWidth(
          rows.map(r => r[e as keyof typeof r] as string),
          { maxWidth: 400, stripHTML: true },
        ),
      ]),
    ),
    ...Object.fromEntries(
      filteredMetadataKeys.map(e => [
        e,
        measureGridWidth(
          rows.map(r => r.metadata[e]),
          { maxWidth: 400, stripHTML: true },
        ),
      ]),
    ),
  } as Record<string, number | undefined>)

  const [visible, setVisible] = useState(
    Object.fromEntries(fields.map(c => [c, true])),
  )
  useEffect(() => {
    setVisible(visible => ({
      ...Object.fromEntries(fields.map(c => [c, true])),
      ...visible,
    }))
  }, [fields])

  useEffect(() => {
    setWidths(widths => ({
      name: widths.name,
      ...Object.fromEntries(
        filteredNonMetadataKeys
          .filter(f => visible[f])
          .map(e => [
            e,
            measureGridWidth(
              rows.map(r => r[e as keyof typeof r]),
              { stripHTML: true, maxWidth: 400 },
            ),
          ]),
      ),
      ...Object.fromEntries(
        filteredMetadataKeys
          .filter(f => visible[f])
          .map(e => [
            e,
            measureGridWidth(
              rows.map(r => r.metadata[e]),
              { stripHTML: true, maxWidth: 400 },
            ),
          ]),
      ),
    }))
  }, [filteredMetadataKeys, visible, filteredNonMetadataKeys, showSparse, rows])

  const widthsDebounced = useDebounce(widths, 200)

  const columns = [
    {
      field: 'name',
      hideable: false,
      renderCell: (params: GridCellParams) => {
        const { value, id, row } = params
        return (
          <div className={classes.cell}>
            <SanitizedHTML html={value as string} />
            <IconButton
              onClick={e =>
                setInfo({
                  target: e.currentTarget,
                  id: id as string,
                  conf: row.conf,
                })
              }
            >
              <MoreHoriz />
            </IconButton>
          </div>
        )
      },
      width: widthsDebounced.name ?? 100,
    },
    ...filteredNonMetadataKeys.map(e => ({
      field: e,
      width: widthsDebounced[e] ?? 100,
      renderCell: (params: GridCellParams) => {
        const val = params.value as string
        return val ? <SanitizedHTML className={classes.cell} html={val} /> : ''
      },
    })),
    ...filteredMetadataKeys.map(e => ({
      field: `m.${e}`,
      label: e,
      width: widthsDebounced[e] ?? 100,
      valueGetter: (params: GridCellParams) => params.row.metadata[e],
      renderCell: (params: GridCellParams) => {
        const val = params.row.metadata[e] as string
        return val ? <SanitizedHTML className={classes.cell} html={val} /> : ''
      },
    })),
  ]

  const shownTrackIds = new Set(
    tracks.map(t => t.configuration.trackId as string),
  )

  return (
    <>
      {info ? (
        <JBrowseMenu
          anchorEl={info?.target}
          menuItems={session.getTrackActionMenuItems?.(info.conf) || []}
          onMenuItemClick={(_event, callback) => {
            callback()
            setInfo(undefined)
          }}
          open={!!info}
          onClose={() => setInfo(undefined)}
        />
      ) : null}
      <FacetedHeader model={model} />

      <div
        ref={ref}
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
          <ResizeBar
            checkbox
            widths={Object.values(widths).map(f => f ?? 100)}
            setWidths={newWidths =>
              setWidths(
                Object.fromEntries(
                  Object.entries(widths).map((entry, idx) => [
                    entry[0],
                    newWidths[idx],
                  ]),
                ),
              )
            }
            scrollLeft={scrollLeft}
          />
          <DataGrid
            rows={filteredRows}
            columnVisibilityModel={visible}
            onColumnVisibilityModelChange={newModel => setVisible(newModel)}
            columnHeaderHeight={35}
            checkboxSelection
            disableRowSelectionOnClick
            keepNonExistentRowsSelected
            onRowSelectionModelChange={userSelectedIds => {
              if (!useShoppingCart) {
                const a1 = shownTrackIds
                const a2 = new Set(userSelectedIds as string[])
                // synchronize the user selection with the view
                // see share https://stackoverflow.com/a/33034768/2129219
                transaction(() => {
                  ;[...a1].filter(x => !a2.has(x)).map(t => view.hideTrack(t))
                  ;[...a2].filter(x => !a1.has(x)).map(t => view.showTrack(t))
                })
              } else {
                const root = getRoot(model)
                const schema = pluginManager.pluggableConfigSchemaType('track')
                const tracks = userSelectedIds.map(id =>
                  resolveIdentifier(schema, root, id),
                )
                model.setSelection(tracks)
              }
            }}
            rowSelectionModel={
              useShoppingCart
                ? selection.map(s => s.trackId)
                : [...shownTrackIds]
            }
            slots={{ toolbar: showOptions ? GridToolbar : null }}
            slotProps={{
              toolbar: {
                printOptions: {
                  disableToolbarButton: true,
                },
              },
            }}
            columns={columns}
            rowHeight={25}
          />
        </div>

        {showFilters ? (
          <>
            <ResizeHandle
              vertical
              onDrag={dist => faceted.setPanelWidth(panelWidth - dist)}
              style={{ marginLeft: 5, background: 'grey', width: 5 }}
            />
            <div
              style={{
                width: panelWidth,
                overflowY: 'auto',
                overflowX: 'hidden',
              }}
            >
              <FacetFilters
                model={model}
                width={panelWidth - 10}
                rows={rows}
                columns={columns}
              />
            </div>
          </>
        ) : null}
      </div>
    </>
  )
})

export default FacetedSelector
