import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import FeatureDetails from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/FeatureDetails'
import Formatter from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/Formatter'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'

import LinkToSyntenyView from './LinkToSyntenyView.tsx'

import type { SyntenyFeatureDetailModel } from './types.ts'

const SyntenyFeatureDetail = observer(function SyntenyFeatureDetail(props: {
  model: SyntenyFeatureDetailModel
}) {
  const { model } = props
  const { featureData } = model
  return featureData ? (
    <Paper>
      <FeatureDetails
        {...props}
        feature={featureData}
        formatter={value => <Formatter value={value} />}
      />
      <BaseCard title="Link to view">
        <LinkToSyntenyView model={model} feat={featureData} />
      </BaseCard>
    </Paper>
  ) : (
    <div>
      No feature loaded, may not be available after page refresh because it was
      too large for localStorage
    </div>
  )
})

export default SyntenyFeatureDetail
