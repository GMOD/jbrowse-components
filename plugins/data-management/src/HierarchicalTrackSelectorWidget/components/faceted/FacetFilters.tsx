import React, { useState } from 'react'
import {
  Typography,
  FormControl,
  Select,
  IconButton,
  Tooltip,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'

// icon
import ClearIcon from '@mui/icons-material/Clear'
import MinimizeIcon from '@mui/icons-material/Minimize'
import AddIcon from '@mui/icons-material/Add'

const useStyles = makeStyles()(theme => ({
  facet: {
    margin: 0,
    marginLeft: theme.spacing(2),
  },
  select: {
    marginBottom: theme.spacing(2),
  },
}))

function FacetFilter({
  column,
  vals,
  width,
  dispatch,
  filters,
}: {
  column: { field: string }
  vals: [string, number][]
  width: number
  dispatch: (arg: { key: string; val: string[] }) => void
  filters: Record<string, string[]>
}) {
  const { classes } = useStyles()
  const [visible, setVisible] = useState(true)
  return (
    <FormControl key={column.field} className={classes.facet} style={{ width }}>
      <div style={{ display: 'flex' }}>
        <Typography>{column.field}</Typography>
        <Tooltip title="Clear selection on this facet filter">
          <IconButton
            onClick={() => {
              dispatch({ key: column.field, val: [] })
            }}
            size="small"
          >
            <ClearIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Minimize/expand this facet filter">
          <IconButton onClick={() => setVisible(!visible)} size="small">
            {visible ? <MinimizeIcon /> : <AddIcon />}
          </IconButton>
        </Tooltip>
      </div>
      {visible ? (
        <Select
          multiple
          native
          className={classes.select}
          value={filters[column.field]}
          onChange={event => {
            // @ts-expect-error
            const { options } = event.target
            const val: string[] = []
            const len = options.length
            for (let i = 0; i < len; i++) {
              if (options[i].selected) {
                val.push(options[i].value)
              }
            }
            dispatch({ key: column.field, val })
          }}
        >
          {vals
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([name, count]) => (
              <option key={name} value={name}>
                {name} ({count})
              </option>
            ))}
        </Select>
      ) : null}
    </FormControl>
  )
}

export default function FacetFilters({
  rows,
  columns,
  dispatch,
  filters,
  width,
}: {
  rows: Record<string, unknown>[]
  filters: Record<string, string[]>
  columns: { field: string }[]
  dispatch: (arg: { key: string; val: string[] }) => void
  width: number
}) {
  const facets = columns.slice(1)
  const uniqs = facets.map(() => new Map<string, number>())
  for (const row of rows) {
    for (const [index, column] of facets.entries()) {
      const elt = uniqs[index]
      const key = `${row[column.field] || ''}`
      const val = elt.get(key)
      // we don't allow filtering on empty yet
      if (key) {
        if (val === undefined) {
          elt.set(key, 1)
        } else {
          elt.set(key, val + 1)
        }
      }
    }
  }

  return (
    <div>
      {facets.map((column, index) => (
        <FacetFilter
          key={column.field}
          vals={[...uniqs[index]]}
          column={column}
          width={width}
          dispatch={dispatch}
          filters={filters}
        />
      ))}
    </div>
  )
}
