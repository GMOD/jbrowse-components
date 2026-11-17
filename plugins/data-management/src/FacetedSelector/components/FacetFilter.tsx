import { useState } from 'react'

import { coarseStripHTML } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import AddIcon from '@mui/icons-material/Add'
import ClearIcon from '@mui/icons-material/Clear'
import MinimizeIcon from '@mui/icons-material/Minimize'
import { Checkbox, IconButton, Tooltip, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { trackNameCollator } from '../../shared/collator.ts'
import { checkboxSx } from './facetedTableStyles.ts'
import { facetLabel } from './util.ts'

import type { FacetedModel } from '../facetedModel.ts'

const useStyles = makeStyles()(theme => ({
  facet: {
    margin: theme.spacing(0, 0, 1.5, 2),
  },
  heading: {
    display: 'flex',
    alignItems: 'center',
  },
  label: {
    flexGrow: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontWeight: theme.typography.fontWeightMedium,
  },
  values: {
    maxHeight: 200,
    overflowY: 'auto',
    margin: 0,
    padding: 0,
    listStyle: 'none',
  },
  value: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    cursor: 'pointer',
    fontSize: theme.typography.body2.fontSize,
    lineHeight: '24px',
  },
  valueName: {
    flexGrow: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  count: {
    color: theme.palette.text.secondary,
    paddingRight: theme.spacing(1),
  },
}))

const FacetFilter = observer(function FacetFilter({
  field,
  vals,
  faceted,
}: {
  field: string
  vals: [string, number][]
  faceted: FacetedModel
}) {
  const { classes } = useStyles()
  const [expanded, setExpanded] = useState(true)
  const { filters, nonMetadataFieldSet } = faceted
  const selected = filters.get(field) ?? []
  const label = facetLabel(field, nonMetadataFieldSet)
  return (
    <div className={classes.facet} role="group" aria-label={label}>
      <div className={classes.heading}>
        <Typography variant="body2" className={classes.label} title={label}>
          {label}
        </Typography>
        {selected.length ? (
          <Tooltip title="Clear this filter">
            <IconButton
              size="small"
              aria-label={`Clear ${label} filter`}
              onClick={() => {
                faceted.setFilter(field, [])
              }}
            >
              <ClearIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : null}
        <IconButton
          size="small"
          aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
          onClick={() => {
            setExpanded(!expanded)
          }}
        >
          {expanded ? (
            <MinimizeIcon fontSize="small" />
          ) : (
            <AddIcon fontSize="small" />
          )}
        </IconButton>
      </div>
      {expanded ? (
        <ul className={classes.values}>
          {vals
            .toSorted((a, b) => trackNameCollator.compare(a[0], b[0]))
            .map(([value, count]) => {
              const text = coarseStripHTML(value)
              return (
                <li key={value}>
                  <label className={classes.value} title={text}>
                    <Checkbox
                      size="small"
                      sx={checkboxSx}
                      checked={selected.includes(value)}
                      slotProps={{ input: { 'aria-label': text } }}
                      onChange={(_, checked) => {
                        faceted.setFilter(
                          field,
                          checked
                            ? [...selected, value]
                            : selected.filter(v => v !== value),
                        )
                      }}
                    />
                    <span className={classes.valueName}>{text}</span>
                    <span className={classes.count}>{count}</span>
                  </label>
                </li>
              )
            })}
        </ul>
      ) : null}
    </div>
  )
})

export default FacetFilter
