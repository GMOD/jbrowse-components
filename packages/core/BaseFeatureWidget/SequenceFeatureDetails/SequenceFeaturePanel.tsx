import React, { lazy, useState, Suspense } from 'react'
import { Button, FormControl } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import { LoadingEllipses } from '../../ui'
import { BaseFeatureWidgetModel } from '../stateModelFactory'
import { SimpleFeatureSerialized } from '../../util'

// lazies
const SequenceFeatureDetails = lazy(() => import('./SequenceFeatureDetails'))

const useStyles = makeStyles()(theme => ({
  formControl: {
    margin: 0,
  },

  container: {
    marginTop: theme.spacing(4),
    marginBottom: theme.spacing(4),
  },
}))

// display the stitched-together sequence of a gene's CDS, cDNA, or protein
// sequence. this is a best effort and weird genomic phenomena could lead these
// to not be 100% accurate
const SequenceFeaturePanel = observer(function ({
  model,
  feature,
}: {
  model: BaseFeatureWidgetModel
  feature: SimpleFeatureSerialized
}) {
  const { classes } = useStyles()
  const [shown, setShown] = useState(false)

  return !model ? null : (
    <div className={classes.container}>
      <FormControl className={classes.formControl}>
        <Button variant="contained" onClick={() => setShown(!shown)}>
          {shown ? 'Hide sequence' : 'Show sequence'}
        </Button>
      </FormControl>
      {shown ? (
        <Suspense fallback={<LoadingEllipses />}>
          <SequenceFeatureDetails
            key={feature.uniqueId}
            model={model}
            feature={feature}
          />
        </Suspense>
      ) : null}
    </div>
  )
})

export default SequenceFeaturePanel
