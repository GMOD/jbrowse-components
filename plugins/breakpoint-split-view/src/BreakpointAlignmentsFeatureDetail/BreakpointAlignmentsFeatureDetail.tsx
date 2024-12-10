import {
  BaseAttributes,
  BaseCoreDetails,
} from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'

import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

const BreakpointAlignmentsFeatureDetail = observer(function ({
  model,
}: {
  model: {
    featureData: {
      feature1: SimpleFeatureSerialized
      feature2: SimpleFeatureSerialized
    }
  }
}) {
  const { featureData } = model
  const { feature1, feature2 } = structuredClone(featureData)
  return (
    <Paper>
      <BaseCoreDetails title="Feature 1" feature={feature1} />
      <BaseCoreDetails title="Feature 2" feature={feature2} />
      <BaseAttributes title="Feature 1 attributes" feature={feature1} />
      <BaseAttributes title="Feature 2 attributes" feature={feature2} />
    </Paper>
  )
})

export default BreakpointAlignmentsFeatureDetail
