import { useState } from 'react'

import { coarseStripHTML } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import AddIcon from '@mui/icons-material/Add'
import ClearIcon from '@mui/icons-material/Clear'
import MinimizeIcon from '@mui/icons-material/Minimize'
import { Button, IconButton, Tooltip, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import CheckboxLite from '../../HierarchicalTrackSelectorWidget/components/tree/CheckboxLite.tsx'
import { trackNameCollator } from '../../shared/collator.ts'
import { facetLabel } from './util.ts'

import type { FacetedModel } from '../facetedModel.ts'

// a facet lists its most common values first, this many until asked for more
const SHOWN_VALUES = 8

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
  checkbox: {
    transform: 'scale(0.8)',
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
  more: {
    padding: theme.spacing(0, 0.5),
    minWidth: 0,
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
  const [showAll, setShowAll] = useState(false)
  const { filters, nonMetadataFieldSet } = faceted
  const selected = filters.get(field) ?? []
  const label = facetLabel(field, nonMetadataFieldSet)
  const sorted = vals.toSorted(
    (a, b) => b[1] - a[1] || trackNameCollator.compare(a[0], b[0]),
  )
  const listed = showAll
    ? sorted
    : sorted.filter(
        ([value], i) => i < SHOWN_VALUES || selected.includes(value),
      )
  const hiddenCount = sorted.length - listed.length
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
        <>
          <ul className={classes.values}>
            {listed.map(([value, count]) => {
              const text = coarseStripHTML(value)
              return (
                <li key={value}>
                  <label className={classes.value} title={text}>
                    <CheckboxLite
                      className={classes.checkbox}
                      label={text}
                      checked={selected.includes(value)}
                      onChange={event => {
                        faceted.setFilter(
                          field,
                          event.target.checked
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
          {hiddenCount > 0 || showAll ? (
            <Button
              size="small"
              className={classes.more}
              onClick={() => {
                setShowAll(!showAll)
              }}
            >
              {showAll ? 'Show fewer' : `Show ${hiddenCount} more`}
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  )
})

export default FacetFilter
