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
  const uniqs = facets.map(() => new Set<string>())
  rows.forEach(row => {
    facets.forEach((column, index) => {
      uniqs[index].add(`${row[column.field] || ''}`)
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
              {vals
                .filter(f => !!f)
                .map(name => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
            </Select>
          </FormControl>
        )
      })}
    </div>
  )
}
