import React, { useMemo, useState, useEffect, useReducer } from 'react'
import { IconButton } from '@mui/material'
import { transaction } from 'mobx'
import { observer } from 'mobx-react'
import { getRoot, resolveIdentifier } from 'mobx-state-tree'
import { DataGrid, GridCellParams } from '@mui/x-data-grid'

// jbrowse
import { getTrackName } from '@jbrowse/core/util/tracks'
import { ResizeHandle } from '@jbrowse/core/ui'
import JBrowseMenu from '@jbrowse/core/ui/Menu'
import ResizeBar, { useResizeBar } from '@jbrowse/core/ui/ResizeBar'
import {
  getEnv,
  getSession,
  measureGridWidth,
  useDebounce,
} from '@jbrowse/core/util'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'

// icons
import MoreHoriz from '@mui/icons-material/MoreHoriz'

// locals
import { matches, HierarchicalTrackSelectorModel } from '../../model'
import FacetedHeader from './FacetedHeader'
import FacetFilters from './FacetFilters'

const nonMetadataKeys = ['category', 'adapter', 'description'] as const

export interface InfoArgs {
  target: HTMLElement
  id: string
  conf: AnyConfigurationModel
}

function getRootKeys(obj: Record<string, unknown>) {
  return Object.entries(obj)
    .map(([key, val]) => (typeof val === 'string' ? key : ''))
    .filter(f => !!f)
}

const frac = 0.75

export default observer(function FacetedSelector({
  model,
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const { assemblyNames, view, selection } = model
  const { pluginManager } = getEnv(model)
  const { ref, scrollLeft } = useResizeBar()

  const [filterText, setFilterText] = useState('')
  const [info, setInfo] = useState<InfoArgs>()
  const [useShoppingCart, setUseShoppingCart] = useState(false)
  const [hideSparse, setHideSparse] = useState(true)
  const [panelWidth, setPanelWidth] = useState(400)

  const assemblyName = assemblyNames[0]
  const session = getSession(model)
  const filterDebounced = useDebounce(filterText, 400)
  const [filters, dispatch] = useReducer(
    (
      state: Record<string, string[]>,
      update: { key: string; val: string[] },
    ) => {
      return { ...state, [update.key]: update.val }
    },
    {},
  )

  const rows = useMemo(() => {
    // metadata is spread onto the object for easier access and sorting
    // by the mui data grid (it's unable to sort by nested objects)
    return model
      .trackConfigurations(assemblyName)
      .filter(conf => matches(filterDebounced, conf, session))
      .map(track => {
        const metadata = readConfObject(track, 'metadata')
        return {
          id: track.trackId,
          conf: track,
          name: getTrackName(track, session),
          category: readConfObject(track, 'category')?.join(', '),
          adapter: readConfObject(track, 'adapter')?.type,
          description: readConfObject(track, 'description'),
          metadata,
          ...metadata,
        }
      })
  }, [assemblyName, model, filterDebounced, session])

  const filteredNonMetadataKeys = useMemo(
    () =>
      nonMetadataKeys.filter(f =>
        !hideSparse ? true : rows.map(r => r[f]).filter(f => !!f).length > 5,
      ),
    [hideSparse, rows],
  )

  const filteredMetadataKeys = useMemo(
    () =>
      [...new Set(rows.map(row => getRootKeys(row.metadata)).flat())].filter(
        f =>
          !hideSparse
            ? true
            : rows.map(r => r.metadata[f]).filter(f => !!f).length > 5,
      ),
    [hideSparse, rows],
  )

  const [widths, setWidths] = useState([
    measureGridWidth(
      rows.map(r => r.name),
      { maxWidth: 500 },
    ) + 15,
    ...filteredNonMetadataKeys.map(e =>
      measureGridWidth(
        rows.map(r => r[e]),
        { maxWidth: 400 },
      ),
    ),
    ...filteredMetadataKeys.map(e =>
      measureGridWidth(
        rows.map(r => r.metadata[e]),
        { maxWidth: 400 },
      ),
    ),
  ])

  useEffect(() => {
    setWidths(widths => [
      widths[0],
      ...filteredNonMetadataKeys.map(e =>
        measureGridWidth(rows.map(r => r[e])),
      ),
      ...filteredMetadataKeys.map(e =>
        measureGridWidth(rows.map(r => r.metadata[e])),
      ),
    ])
  }, [filteredMetadataKeys, filteredNonMetadataKeys, hideSparse, rows])

  const widthsDebounced = useDebounce(widths, 400)

  const columns = [
    {
      field: 'name',
      renderCell: (params: GridCellParams) => {
        const { value, id, row } = params
        return (
          <>
            {value}
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
          </>
        )
      },
      width: widthsDebounced[0] || 100, // can be undefined before useEffect update
    },
    ...filteredNonMetadataKeys.map((e, i) => ({
      field: e,
      width: widthsDebounced[i + 1] || 100, // can be undefined before useEffect update
      hideable: false, // doesn't work with our resize bar yet
    })),
    ...filteredMetadataKeys.map((e, i) => ({
      field: e,
      width: widthsDebounced[i + 1 + filteredNonMetadataKeys.length] || 100, // can be undefined before useEffect update
      hideable: false, // doesn't work with our resize bar yet
    })),
  ]
  const shownTrackIds = view.tracks.map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (t: any) => t.configuration.trackId,
  ) as string[]

  const arrFilters = Object.entries(filters).filter(f => f[1].length > 0)
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
      <FacetedHeader
        setHideSparse={setHideSparse}
        setFilterText={setFilterText}
        setUseShoppingCart={setUseShoppingCart}
        hideSparse={hideSparse}
        filterText={filterText}
        useShoppingCart={useShoppingCart}
        model={model}
      />

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
            width: window.innerWidth * frac - panelWidth,
          }}
        >
          <ResizeBar
            checkbox
            widths={widths}
            setWidths={setWidths}
            scrollLeft={scrollLeft}
          />
          <DataGrid
            rows={rows.filter(row =>
              arrFilters.every(([key, val]) => val.includes(row[key])),
            )}
            headerHeight={35}
            checkboxSelection
            disableSelectionOnClick
            keepNonExistentRowsSelected
            onSelectionModelChange={userSelectedIds => {
              if (!useShoppingCart) {
                const a1 = shownTrackIds
                const a2 = userSelectedIds as string[]
                // synchronize the user selection with the view
                // see share https://stackoverflow.com/a/33034768/2129219
                transaction(() => {
                  a1.filter(x => !a2.includes(x)).map(t => view.hideTrack(t))
                  a2.filter(x => !a1.includes(x)).map(t => view.showTrack(t))
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
            selectionModel={
              useShoppingCart ? selection.map(s => s.trackId) : shownTrackIds
            }
            columns={columns}
            rowHeight={25}
          />
        </div>
        <ResizeHandle
          vertical
          onDrag={dist => setPanelWidth(panelWidth - dist)}
          style={{ background: 'grey', width: 5 }}
        />
        <div
          style={{ width: panelWidth, overflowY: 'auto', overflowX: 'hidden' }}
        >
          <FacetFilters
            width={panelWidth - 10}
            rows={rows}
            columns={columns}
            dispatch={dispatch}
            filters={filters}
          />
        </div>
      </div>
    </>
  )
})
