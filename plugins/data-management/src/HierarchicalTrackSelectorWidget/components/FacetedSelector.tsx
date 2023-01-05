import React, { useState } from 'react'
import { IconButton, InputAdornment, TextField } from '@mui/material'
import { transaction } from 'mobx'
import { observer } from 'mobx-react'
import { getTrackName } from '@jbrowse/core/util/tracks'
import JBrowseMenu from '@jbrowse/core/ui/Menu'
import { getSession, measureGridWidth } from '@jbrowse/core/util'
import { DataGrid, GridCellParams } from '@mui/x-data-grid'

import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'

// icons
import ClearIcon from '@mui/icons-material/Clear'
import MoreHoriz from '@mui/icons-material/MoreHoriz'

// locals
import { matches, HierarchicalTrackSelectorModel } from '../model'

export interface InfoArgs {
  target: HTMLElement
  id: string
  conf: AnyConfigurationModel
}

type Facets = Record<string, string>

function getKeys(obj: Record<string, unknown>): string[] {
  const keys = Object.keys(obj)
  let ret = [] as string[]
  console.log({ keys })
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const o = obj[key]
    if (typeof o === 'object' && o !== null && !Array.isArray(o)) {
      console.log('k1', o)
      ret = [...ret, ...getKeys(o as Record<string, unknown>)]
    } else {
      console.log('k2', key)
      ret = [...ret, key]
    }
  }
  console.log({ ret })
  return ret
}

function FacetedSelector({ model }: { model: HierarchicalTrackSelectorModel }) {
  const { assemblyNames, view } = model
  const [filterText, setFilterText] = useState('')
  const [info, setInfo] = useState<InfoArgs>()
  const [facets, setFacets] = useState<Facets>({})
  const assemblyName = assemblyNames[0]
  const session = getSession(model)

  const tracks = model
    .trackConfigurations(assemblyName)
    .filter(conf => matches(filterText, conf, session))

  const metadataTracks = tracks.map(track => readConfObject(track, 'metadata'))
  const metadataKeys = metadataTracks
    .map(track => getKeys(track))
    .filter(f => f.length)
  console.log({ metadataKeys })

  const rows = tracks
    .map(track => ({
      id: track.trackId,
      name: getTrackName(track, session),
      category: readConfObject(track, 'category')?.join(', '),
      conf: track,
    }))
    .filter(f => {
      const r = facets['category']
      return r ? f.category?.includes(r) : true
    })

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
              style={{ padding: 0 }}
              color="secondary"
              data-testid={`htsTrackEntryMenu-${id}`}
            >
              <MoreHoriz />
            </IconButton>
          </>
        )
      },
      width: measureGridWidth(rows.map(r => r.name)) + 15,
    },
    ...['category'].map(e => ({
      field: e,
      // @ts-ignore
      width: measureGridWidth(rows.map(r => r[e])),
    })),
  ]
  const shownTrackIds: string[] = view.tracks.map(
    (t: any) => t.configuration.trackId,
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
          open={Boolean(info)}
          onClose={() => setInfo(undefined)}
        />
      ) : null}
      <TextField
        label="Filter tracks"
        value={filterText}
        onChange={event => setFilterText(event.target.value)}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton color="secondary" onClick={() => setFilterText('')}>
                <ClearIcon />
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
      <div style={{ display: 'flex', margin: 5 }}>
        <div style={{ width: 200, marginRight: 10 }}>
          <TextField
            value={facets['category']}
            onChange={event =>
              setFacets({ ...facets, category: event.target.value })
            }
            label="Filter category"
          />
        </div>
        <div
          style={{
            height: window.innerHeight * 0.75,
            width: window.innerWidth * 0.75,
            overflow: 'auto',
          }}
        >
          <DataGrid
            rows={rows}
            checkboxSelection
            disableSelectionOnClick
            onSelectionModelChange={userSelectedIds => {
              const arr1 = shownTrackIds
              const arr2 = userSelectedIds
              // synchronize the user selection with the view
              // see share https://stackoverflow.com/a/33034768/2129219
              const tracksToHide = arr1.filter(x => !arr2.includes(x))
              const tracksToShow = arr2.filter(x => !arr1.includes(x as string))
              transaction(() => {
                tracksToHide.map(t => view.hideTrack(t))
                tracksToShow.map(t => view.showTrack(t))
              })
            }}
            selectionModel={shownTrackIds}
            columns={infoFields}
            rowHeight={25}
            disableColumnMenu
          />
        </div>
      </div>
    </>
  )
}

export default observer(FacetedSelector)
