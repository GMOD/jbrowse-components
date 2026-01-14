import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import FeatureDetails from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/FeatureDetails'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'

import Formatter from './Formatter.tsx'
import LinkToSyntenyView from './LinkToSyntenyView.tsx'

import type { SyntenyFeatureDetailModel } from './types.ts'

const SyntenyFeatureDetail = observer(function SyntenyFeatureDetail(props: {
  model: SyntenyFeatureDetailModel
}) {
  const { model } = props
  const { featureData } = model
  const feat = structuredClone(featureData)
  return feat ? (
    <Paper>
      <FeatureDetails
        {...props}
        feature={feat}
        formatter={value => <Formatter value={value} />}
      />
      <BaseCard title="Link to view">
        <LinkToSyntenyView model={model} feat={feat} />
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
