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
import { coarseStripHTML } from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  facet: {
    margin: 0,
    marginLeft: theme.spacing(2),
  },
  select: {
    marginBottom: theme.spacing(2),
  },
}))

function ClearButton({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip title="Clear selection on this facet filter">
      <IconButton onClick={() => onClick()} size="small">
        <ClearIcon />
      </IconButton>
    </Tooltip>
  )
}

function ExpandButton({
  visible,
  onClick,
}: {
  visible: boolean
  onClick: () => void
}) {
  return (
    <Tooltip title="Minimize/expand this facet filter">
      <IconButton onClick={() => onClick()} size="small">
        {visible ? <MinimizeIcon /> : <AddIcon />}
      </IconButton>
    </Tooltip>
  )
}

export default function FacetFilter({
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
        <ClearButton onClick={() => dispatch({ key: column.field, val: [] })} />
        <ExpandButton visible={visible} onClick={() => setVisible(!visible)} />
      </div>
      {visible ? (
        <Select
          multiple
          native
          className={classes.select}
          value={filters[column.field]}
          onChange={event => {
            dispatch({
              key: column.field,
              // @ts-expect-error
              val: [...event.target.options]
                .filter(opt => opt.selected)
                .map(opt => opt.value),
            })
          }}
        >
          {vals
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([name, count]) => (
              <option key={name} value={name}>
                {coarseStripHTML(name)} ({count})
              </option>
            ))}
        </Select>
      ) : null}
    </FormControl>
  )
}
