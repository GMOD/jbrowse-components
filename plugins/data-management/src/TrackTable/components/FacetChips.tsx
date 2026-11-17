import { useState } from 'react'

import { alpha } from '@jbrowse/core/ui/palette'
import { coarseStripHTML } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import { Chip, Popover } from '@mui/material'
import { observer } from 'mobx-react'

import FacetFilter from './FacetFilter.tsx'
import { facetLabel } from './util.ts'

import type { TrackTableModel } from '../trackTableModel.ts'

const useStyles = makeStyles()(theme => {
  const accent =
    theme.palette.mode === 'dark'
      ? theme.palette.accent
      : theme.palette.primary.main
  return {
    row: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(0.5),
      margin: theme.spacing(0, 1, 1, 2),
    },
    chipLabel: {
      display: 'flex',
      alignItems: 'center',
    },
    arrow: {
      fontSize: 18,
      marginRight: -6,
    },
    active: {
      borderColor: accent,
      backgroundColor: alpha(accent, 0.14),
      color: accent,
      fontWeight: 500,
      '& .MuiChip-deleteIcon': {
        color: alpha(accent, 0.7),
        '&:hover': { color: accent },
      },
    },
    popover: {
      width: 260,
      maxHeight: 420,
      padding: theme.spacing(1, 0, 0, 1),
    },
  }
})

function selectionText(label: string, selected: string[]) {
  const first = coarseStripHTML(selected[0] ?? '')
  return selected.length > 1
    ? `${label}: ${first} +${selected.length - 1}`
    : `${label}: ${first}`
}

/**
 * The facet filters as a row of chips: one for each leading facet and each
 * facet still filtering, and "More filters" for the rest. A chip opens its
 * facet's values; an active chip names its selection and clears with its ×.
 */
const FacetChips = observer(function FacetChips({
  table,
}: {
  table: TrackTableModel
}) {
  const { classes } = useStyles()
  const [open, setOpen] = useState<{ el: HTMLElement; field?: string }>()
  const { filterFacets, chipFacets, moreFacets, filters, nonMetadataFieldSet } =
    table
  const chips = filterFacets.filter(
    f => chipFacets.includes(f) || f === open?.field,
  )
  const listed = open ? (open.field ? [open.field] : moreFacets) : []
  return chips.length || moreFacets.length ? (
    <div className={classes.row}>
      {chips.map(field => {
        const label = facetLabel(field, nonMetadataFieldSet)
        const selected = filters.get(field)
        return (
          <Chip
            key={field}
            size="small"
            variant="outlined"
            className={selected ? classes.active : undefined}
            aria-haspopup="true"
            aria-expanded={open?.field === field}
            label={
              selected ? (
                selectionText(label, selected)
              ) : (
                <span className={classes.chipLabel}>
                  {label}
                  <ArrowDropDownIcon className={classes.arrow} />
                </span>
              )
            }
            onClick={event => {
              setOpen({ el: event.currentTarget, field })
            }}
            onDelete={
              selected
                ? () => {
                    table.setFilter(field, [])
                  }
                : undefined
            }
          />
        )
      })}
      {moreFacets.length ? (
        <Chip
          size="small"
          variant="outlined"
          aria-haspopup="true"
          aria-expanded={!!open && !open.field}
          label={
            <span className={classes.chipLabel}>
              More filters
              <ArrowDropDownIcon className={classes.arrow} />
            </span>
          }
          onClick={event => {
            setOpen({ el: event.currentTarget })
          }}
        />
      ) : null}
      <Popover
        open={!!open}
        anchorEl={open?.el}
        onClose={() => {
          setOpen(undefined)
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <div className={classes.popover}>
          {listed.map(field => (
            <FacetFilter
              key={field}
              field={field}
              vals={[...(table.facetCategoryCounts.get(field) ?? [])]}
              table={table}
              collapsible={!open?.field}
              defaultExpanded={filters.has(field)}
            />
          ))}
        </div>
      </Popover>
    </div>
  ) : null
})

export default FacetChips
