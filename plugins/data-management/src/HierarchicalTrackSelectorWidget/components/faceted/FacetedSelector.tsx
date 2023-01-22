import React, { useMemo, useState, useEffect } from 'react'
import { IconButton } from '@mui/material'
import { transaction } from 'mobx'
import { observer } from 'mobx-react'
import { DataGrid, GridCellParams } from '@mui/x-data-grid'
import { makeStyles } from 'tss-react/mui'

// jbrowse
import { getTrackName } from '@jbrowse/core/util/tracks'
import JBrowseMenu from '@jbrowse/core/ui/Menu'
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
import ResizeBar from './ResizeBar'
import { getRoot, resolveIdentifier } from 'mobx-state-tree'
import FacetedHeader from './FacetedHeader'

const useStyles = makeStyles()({
  noPadding: {
    padding: 0,
  },
})

const keys = ['category', 'adapter'] as const

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

export default observer(function FacetedSelector({
  model,
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const { assemblyNames, view, selection } = model
  const [filterText, setFilterText] = useState('')
  const [info, setInfo] = useState<InfoArgs>()
  const { classes } = useStyles()
  const assemblyName = assemblyNames[0]
  const session = getSession(model)
  const filterDebounced = useDebounce(filterText, 400)
  const [useShoppingCart, setUseShoppingCart] = useState(false)
  const [hideSparse, setHideSparse] = useState(false)
  const { pluginManager } = getEnv(model)

  const rows = useMemo(() => {
    return model
      .trackConfigurations(assemblyName)
      .filter(conf => matches(filterDebounced, conf, session))
      .map(track => ({
        id: track.trackId,
        name: getTrackName(track, session),
        category: readConfObject(track, 'category')?.join(', '),
        metadata: readConfObject(track, 'metadata'),
        adapter: readConfObject(track, 'adapter')?.type,
        conf: track,
      }))
  }, [assemblyName, model, filterDebounced, session])

  const allKeys = useMemo(() => {
    return [...new Set(rows.map(r => getRootKeys(r.metadata)).flat())].filter(
      f =>
        !hideSparse
          ? true
          : rows.map(r => r.metadata[f]).filter(f => !!f).length > 5,
    )
  }, [hideSparse, rows])

  const [widths, setWidths] = useState([
    measureGridWidth(rows.map(r => r.name)) + 15,
    ...keys.map(e => measureGridWidth(rows.map(r => r[e]))),
    ...allKeys.map(e => measureGridWidth(rows.map(r => r.metadata[e]))),
  ])

  useEffect(
    () => {
      setWidths([
        ...widths.slice(0, 1 + keys.length),
        ...allKeys.map(e => measureGridWidth(rows.map(r => r.metadata[e]))),
      ])
    },
    // avoid specifying 'widths' in deps, not necessary in this case
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allKeys, rows],
  )

  const widthsDebounced = useDebounce(widths, 400)

  const infoFields = [
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
              className={classes.noPadding}
              color="secondary"
              data-testid={`htsFacetedTrackMenu-${id}`}
            >
              <MoreHoriz />
            </IconButton>
          </>
        )
      },
      width: widthsDebounced[0],
    },
    ...keys.map((e, i) => ({
      field: e,
      width: widthsDebounced[i + 1],
    })),
    ...allKeys.map((e, i) => ({
      field: e,
      renderCell: (params: GridCellParams) => params.row.metadata[e],
      width: widthsDebounced[i + 1 + keys.length],
    })),
  ]
  const shownTrackIds = view.tracks.map(
    (t: any) => t.configuration.trackId,
  ) as string[]

  // starting offset 52 for left checkbox column
  const offsets = [] as number[]
  infoFields
    .map(info => info.width)
    .reduce((a, b, i) => (offsets[i] = a + b), 52)

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

      <div style={{ display: 'flex', margin: 5 }}>
        <div
          style={{
            height: window.innerHeight * 0.75,
            width: window.innerWidth * 0.75,
            overflow: 'auto',
          }}
        >
          <ResizeBar widths={widths} setWidths={setWidths} />
          <DataGrid
            rows={rows}
            checkboxSelection
            disableSelectionOnClick
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
            columns={infoFields}
            rowHeight={25}
          />
        </div>
      </div>
    </>
  )
})
