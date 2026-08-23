import { FeatureWash } from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
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
    <FeatureWash uniqueId={featureData.uniqueId}>
      <Paper>
        <FeatureDetails
          {...props}
          feature={featureData}
          formatter={value => <Formatter value={value} />}
        />
        {/* Its own card, so it can decline to draw one — see LinkToSyntenyView */}
        <LinkToSyntenyView model={model} feat={featureData} />
      </Paper>
    </FeatureWash>
  ) : (
    <div>
      No feature loaded, may not be available after page refresh because it was
      too large for localStorage
    </div>
  )
})

export default SyntenyFeatureDetail
