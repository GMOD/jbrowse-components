import React, { useState } from 'react'
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
import { getEnv, getSession, useDebounce } from '@jbrowse/core/util'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { useResizeBar } from '@jbrowse/core/ui/useResizeBar'
import { makeStyles } from 'tss-react/mui'

// icons
import MoreHoriz from '@mui/icons-material/MoreHoriz'

// locals
import { HierarchicalTrackSelectorModel } from '../../model'
import FacetedHeader from './FacetedHeader'
import FacetFilters from './FacetFilters'

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
    showFilters,
    useShoppingCart,
    showOptions,
    filteredRows,
    filteredNonMetadataKeys,
    filteredMetadataKeys,
    visible,
    widths,
  } = faceted
  const { pluginManager } = getEnv(model)
  const { ref, scrollLeft } = useResizeBar()
  const [info, setInfo] = useState<InfoArgs>()
  const session = getSession(model)
  const tracks = view.tracks as AnyConfigurationModel[]
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
      field: `metadata.${e}`,
      label: e,
      width: widthsDebounced['metadata.' + e] ?? 100,
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
              faceted.setWidths(
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
            onColumnVisibilityModelChange={n => faceted.setVisible(n)}
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
