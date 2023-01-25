import React from 'react'
import {
  Typography,
  FormControl,
  Select,
  IconButton,
  Tooltip,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import ClearIcon from '@mui/icons-material/Clear'

const useStyles = makeStyles()(theme => ({
  facet: {
    width: 390,
    margin: theme.spacing(2),
  },
}))

export default function FacetFilters({
  rows,
  columns,
  dispatch,
  filters,
}: {
  rows: Record<string, unknown>[]
  filters: Record<string, string[]>
  columns: { field: string }[]
  dispatch: (arg: { key: string; val: string[] }) => void
}) {
  const { classes } = useStyles()
  const facets = columns.slice(1)
  const uniqs = facets.map(() => new Map<string, number>())
  rows.forEach(row => {
    facets.forEach((column, index) => {
      const elt = uniqs[index]
      const key = `${row[column.field] || ''}`
      const val = elt.get(key)
      // we don't allow filtering on empty yet
      if (key) {
        if (val !== undefined) {
          elt.set(key, val + 1)
        } else {
          elt.set(key, 1)
        }
      }
    })
  })

  return (
    <div>
      {facets.map((column, index) => {
        const vals = Array.from(uniqs[index])
        return (
          <FormControl key={column.field} className={classes.facet}>
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
            </div>
            <Select
              multiple
              native
              value={filters[column.field]}
              onChange={event => {
                // @ts-ignore
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
              {vals.map(([name, count]) => (
                <option key={name} value={name}>
                  {name} ({count})
                </option>
              ))}
            </Select>
          </FormControl>
        )
      })}
    </div>
  )
}
