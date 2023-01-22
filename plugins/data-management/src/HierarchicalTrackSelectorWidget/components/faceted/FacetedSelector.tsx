import React, { useMemo, useState } from 'react'
import {
  Checkbox,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  TextField,
} from '@mui/material'
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
import ClearIcon from '@mui/icons-material/Clear'
import MoreHoriz from '@mui/icons-material/MoreHoriz'

// locals
import { matches, HierarchicalTrackSelectorModel } from '../../model'
import ResizeBar from './ResizeBar'
import { getRoot, resolveIdentifier } from 'mobx-state-tree'
import ShoppingCart from '../ShoppingCart'

const useStyles = makeStyles()({
  noPadding: {
    padding: 0,
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
        conf: track,
      }))
  }, [assemblyName, model, filterDebounced, session])

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
          open={!!info}
          onClose={() => setInfo(undefined)}
        />
      ) : null}

      <Grid container spacing={4} alignItems="center">
        <Grid item>
          <TextField
            label="Search..."
            value={filterText}
            onChange={event => setFilterText(event.target.value)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    color="secondary"
                    onClick={() => setFilterText('')}
                  >
                    <ClearIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        <Grid item>
          <FormControlLabel
            control={
              <Checkbox
                checked={useShoppingCart}
                onChange={e => setUseShoppingCart(e.target.checked)}
              />
            }
            label="Add tracks to selection instead of turning them on/off"
          />
        </Grid>
        <Grid item>
          <ShoppingCart model={model} />
        </Grid>
      </Grid>
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
