import { FeatureDetailsFrame } from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
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
  return (
    <FeatureDetailsFrame model={model}>
      {featureData ? (
        <Paper>
          <FeatureDetails
            {...props}
            feature={featureData}
            unformatted={model.unformattedFeatureData}
            formatter={value => <Formatter value={value} />}
          />
          <LinkToSyntenyView model={model} feat={featureData} />
        </Paper>
      ) : null}
    </FeatureDetailsFrame>
  )
})

export default SyntenyFeatureDetail
