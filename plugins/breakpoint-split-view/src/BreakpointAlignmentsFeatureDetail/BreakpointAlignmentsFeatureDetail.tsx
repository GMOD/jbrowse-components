import React from 'react'
import {
  BaseCoreDetails,
  BaseAttributes,
} from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'

const BreakpointAlignmentsFeatureDetail = observer(function ({
  model,
}: {
  model: { featureData: Record<string, unknown> }
}) {
  const { feature1, feature2 } = JSON.parse(JSON.stringify(model.featureData))
  return (
    <Paper data-testid="alignment-side-drawer">
      <BaseCoreDetails title="Feature 1" feature={feature1} />
      <BaseCoreDetails title="Feature 2" feature={feature2} />
      <BaseAttributes title="Feature 1 attributes" feature={feature1} />
      <BaseAttributes title="Feature 2 attributes" feature={feature2} />
    </Paper>
  )
})

export default BreakpointAlignmentsFeatureDetail
