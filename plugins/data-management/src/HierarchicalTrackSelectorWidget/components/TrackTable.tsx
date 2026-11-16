import { useEffect } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import useMeasure from '@jbrowse/core/util/useMeasure'
import { observer } from 'mobx-react'

import FacetedSelector from '../../FacetedSelector/components/FacetedSelector.tsx'
import { useFacetedModel } from '../../FacetedSelector/useFacetedModel.ts'

import type { HierarchicalTrackSelectorModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  body: {
    flex: 1,
    minHeight: 0,
    padding: theme.spacing(0, 1, 1, 0.5),
  },
}))

const TrackTable = observer(function TrackTable({
  model,
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const { classes } = useStyles()
  const faceted = useFacetedModel(
    model,
    () => model.listedTrackConfigurations,
    {
      filterText: model.filterText,
      showFilters: false,
    },
  )
  const [ref, { width, height }] = useMeasure()
  const measured = Boolean(width && height)
  useEffect(() => {
    if (measured) {
      ref.current?.querySelector('input')?.focus()
    }
  }, [measured, ref])
  return (
    <div ref={ref} className={classes.body}>
      {width && height ? (
        <FacetedSelector
          model={model}
          faceted={faceted}
          size={{ width, height }}
        />
      ) : null}
    </div>
  )
})

export default TrackTable
