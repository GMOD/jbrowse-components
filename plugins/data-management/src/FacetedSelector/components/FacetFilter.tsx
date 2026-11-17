import { useState } from 'react'

import { coarseStripHTML } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import ArrowRightIcon from '@mui/icons-material/ArrowRight'
import { observer } from 'mobx-react'

import CheckboxLite from '../../HierarchicalTrackSelectorWidget/components/tree/CheckboxLite.tsx'
import { trackNameCollator } from '../../shared/collator.ts'
import { facetLabel } from './util.ts'

import type { FacetedModel } from '../facetedModel.ts'

// a facet with more values than this lists only its most common ones until
// asked for the rest
const LONG_LIST = 20
const SHOWN_VALUES = 10

const ROW_HEIGHT = 20

const useStyles = makeStyles()(theme => {
  const link = {
    padding: 0,
    border: 0,
    background: 'none',
    font: 'inherit',
    fontSize: '0.9em',
    color: theme.palette.text.secondary,
    cursor: 'pointer',
    '&:hover': { color: theme.palette.text.primary },
  }
  return {
    facet: {
      marginBottom: theme.spacing(1),
      fontSize: theme.typography.body2.fontSize,
    },
    heading: {
      display: 'flex',
      alignItems: 'center',
      height: ROW_HEIGHT,
    },
    toggle: {
      ...link,
      display: 'flex',
      alignItems: 'center',
      flexGrow: 1,
      minWidth: 0,
      fontSize: 'inherit',
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.palette.text.primary,
    },
    toggleIcon: {
      fontSize: 16,
      flexShrink: 0,
    },
    label: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    link: {
      ...link,
      flexShrink: 0,
      paddingRight: theme.spacing(1),
    },
    values: {
      margin: 0,
      padding: 0,
      paddingLeft: 4,
      listStyle: 'none',
    },
    value: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      height: ROW_HEIGHT,
      cursor: 'pointer',
    },
    checkbox: {
      flexShrink: 0,
      '& svg': { width: 16, height: 16 },
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
      fontSize: '0.9em',
      paddingRight: theme.spacing(1),
    },
    more: {
      ...link,
      height: ROW_HEIGHT,
      paddingLeft: 24,
    },
  }
})

const FacetFilter = observer(function FacetFilter({
  field,
  vals,
  faceted,
  defaultExpanded = true,
}: {
  field: string
  vals: [string, number][]
  faceted: FacetedModel
  defaultExpanded?: boolean
}) {
  const { classes } = useStyles()
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [showAll, setShowAll] = useState(false)
  const { filters, nonMetadataFieldSet } = faceted
  const selected = filters.get(field) ?? []
  const label = facetLabel(field, nonMetadataFieldSet)
  const sorted = vals.toSorted(
    (a, b) => b[1] - a[1] || trackNameCollator.compare(a[0], b[0]),
  )
  const listed =
    showAll || sorted.length <= LONG_LIST
      ? sorted
      : sorted.filter(
          ([value], i) => i < SHOWN_VALUES || selected.includes(value),
        )
  const hiddenCount = sorted.length - listed.length
  const ToggleIcon = expanded ? ArrowDropDownIcon : ArrowRightIcon
  return (
    <div className={classes.facet} role="group" aria-label={label}>
      <div className={classes.heading}>
        <button
          type="button"
          className={classes.toggle}
          aria-expanded={expanded}
          title={label}
          onClick={() => {
            setExpanded(!expanded)
          }}
        >
          <ToggleIcon className={classes.toggleIcon} />
          <span className={classes.label}>{label}</span>
        </button>
        {selected.length ? (
          <button
            type="button"
            className={classes.link}
            aria-label={`Clear ${label} filter`}
            onClick={() => {
              faceted.setFilter(field, [])
            }}
          >
            clear
          </button>
        ) : null}
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
            <button
              type="button"
              className={classes.more}
              onClick={() => {
                setShowAll(!showAll)
              }}
            >
              {showAll ? 'Show fewer' : `Show ${hiddenCount} more`}
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  )
})

export default FacetFilter
