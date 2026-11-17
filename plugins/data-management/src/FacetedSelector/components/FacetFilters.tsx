import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import FacetFilter from './FacetFilter.tsx'

import type { FacetedModel } from '../facetedModel.ts'

const useStyles = makeStyles()(theme => ({
  root: {
    padding: theme.spacing(0.5, 0, 0, 1),
  },
  clearAll: {
    padding: 0,
    marginBottom: theme.spacing(0.5),
    border: 0,
    background: 'none',
    font: 'inherit',
    fontSize: '0.9em',
    color: theme.palette.text.secondary,
    cursor: 'pointer',
    '&:hover': { color: theme.palette.text.primary },
  },
}))

const FacetFilters = observer(function FacetFilters({
  faceted,
}: {
  faceted: FacetedModel
}) {
  const { classes } = useStyles()
  const { openFacets, facetCategoryCounts, filters } = faceted
  const hasActiveFilters = [...filters.values()].some(v => v.length > 0)
  return (
    <div className={classes.root}>
      {hasActiveFilters ? (
        <button
          type="button"
          className={classes.clearAll}
          onClick={() => {
            faceted.clearFilters()
          }}
        >
          Clear all filters
        </button>
      ) : null}
      {[...facetCategoryCounts]
        .filter(([, categoryCountMap]) => categoryCountMap.size > 0)
        .map(([field, categoryCountMap]) => (
          <FacetFilter
            key={field}
            vals={[...categoryCountMap]}
            field={field}
            faceted={faceted}
            defaultExpanded={openFacets.has(field)}
          />
        ))}
    </div>
  )
})
export default FacetFilters
