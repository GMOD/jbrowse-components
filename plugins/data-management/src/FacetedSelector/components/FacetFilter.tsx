import { useState } from 'react'

import { coarseStripHTML } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import AddIcon from '@mui/icons-material/Add'
import ClearIcon from '@mui/icons-material/Clear'
import MinimizeIcon from '@mui/icons-material/Minimize'
import {
  FormControl,
  IconButton,
  Select,
  Tooltip,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { FacetedModel } from '../facetedModel.ts'

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
      <IconButton onClick={onClick} size="small">
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
      <IconButton onClick={onClick} size="small">
        {visible ? <MinimizeIcon /> : <AddIcon />}
      </IconButton>
    </Tooltip>
  )
}

const FacetFilter = observer(function FacetFilter({
  column,
  vals,
  faceted,
}: {
  column: { field: string }
  vals: [string, number][]
  faceted: FacetedModel
}) {
  const { classes } = useStyles()
  const [visible, setVisible] = useState(true)
  const { filters } = faceted
  const { field } = column
  return (
    <FormControl className={classes.facet} fullWidth>
      <div>
        <Typography component="span">{field}</Typography>
        <ClearButton
          onClick={() => {
            faceted.setFilter(field, [])
          }}
        />
        <ExpandButton
          visible={visible}
          onClick={() => {
            setVisible(!visible)
          }}
        />
      </div>
      {visible ? (
        <Select
          multiple
          native
          className={classes.select}
          value={filters.get(column.field) || []}
          onChange={event => {
            const options = (event.target as unknown as HTMLSelectElement)
              .options
            faceted.setFilter(
              column.field,
              [...options].filter(opt => opt.selected).map(opt => opt.value),
            )
          }}
        >
          {vals
            .toSorted((a, b) => a[0].localeCompare(b[0]))
            .map(([name, count]) => (
              <option key={name} value={name}>
                {coarseStripHTML(name)} ({count})
              </option>
            ))}
        </Select>
      ) : null}
    </FormControl>
  )
})

export default FacetFilter
