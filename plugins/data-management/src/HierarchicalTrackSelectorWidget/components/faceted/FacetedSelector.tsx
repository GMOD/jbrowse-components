import React, { useMemo, useState } from 'react'
import { IconButton, InputAdornment, TextField } from '@mui/material'
import { transaction } from 'mobx'
import { observer } from 'mobx-react'
import { DataGrid, GridCellParams } from '@mui/x-data-grid'
import { makeStyles } from 'tss-react/mui'

// jbrowse
import { getTrackName } from '@jbrowse/core/util/tracks'
import JBrowseMenu from '@jbrowse/core/ui/Menu'
import { getSession, measureGridWidth } from '@jbrowse/core/util'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { ResizeHandle } from '@jbrowse/core/ui'

// icons
import ClearIcon from '@mui/icons-material/Clear'
import MoreHoriz from '@mui/icons-material/MoreHoriz'

// locals
import { matches, HierarchicalTrackSelectorModel } from '../../model'

const useStyles = makeStyles()({
  noPadding: {
    padding: 0,
  },
  resizeBar: {
    background: 'lightgrey',
    height: 12,
    position: 'relative',
  },
  tick: {
    position: 'absolute',
    height: '100%',
    background: 'black',
    width: 1,
  },
})

export interface InfoArgs {
  target: HTMLElement
  id: string
  conf: AnyConfigurationModel
}

function getKeys(obj: Record<string, unknown>): string[] {
  const keys = Object.keys(obj)
  let ret = [] as string[]
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const o = obj[key]
    if (typeof o === 'object' && o !== null && !Array.isArray(o)) {
      ret = [...ret, ...getKeys(o as Record<string, unknown>)]
    } else {
      ret = [...ret, key]
    }
  }
  return ret
}

function FacetedSelector({ model }: { model: HierarchicalTrackSelectorModel }) {
  const { assemblyNames, view } = model
  const [filterText, setFilterText] = useState('')
  const [info, setInfo] = useState<InfoArgs>()
  const assemblyName = assemblyNames[0]
  const session = getSession(model)
  const { classes } = useStyles()

  const rows = useMemo(() => {
    const tracks = model.trackConfigurations(assemblyName)

    return tracks
      .filter(conf => matches(filterText, conf, session))
      .map(track => ({
        id: track.trackId,
        name: getTrackName(track, session),
        category: readConfObject(track, 'category')?.join(', '),
        conf: track,
      }))
  }, [assemblyName, model, filterText, session])

  const [widths, setWidths] = useState([
    measureGridWidth(rows.map(r => r.name)) + 15,
    // @ts-ignore
    ...['category'].map(e => measureGridWidth(rows.map(r => r[e]))),
  ])

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
      width: widths[0],
    },
    ...['category'].map((e, i) => ({
      field: e,
      // @ts-ignore
      width: widths[i + 1],
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
          open={Boolean(info)}
          onClose={() => setInfo(undefined)}
        />
      ) : null}
      <TextField
        label="Search..."
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
        <div
          style={{
            height: window.innerHeight * 0.75,
            width: window.innerWidth * 0.75,
            overflow: 'auto',
          }}
        >
          <div className={classes.resizeBar}>
            {offsets.map((left, i) => (
              <ResizeHandle
                onDrag={distance => {
                  const newWidths = [...widths]
                  newWidths[i] = newWidths[i] + distance
                  setWidths(newWidths)
                }}
                vertical
                className={classes.tick}
                style={{ left }}
              />
            ))}
          </div>
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
          />
        </div>
      </div>
    </>
  )
}

export default observer(FacetedSelector)
