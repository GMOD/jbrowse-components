import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import FeatureDetails from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/FeatureDetails'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'

import Formatter from './Formatter'
import LinkToSyntenyView from './LinkToSyntenyView'

import type { SyntenyFeatureDetailModel } from './types'

const SyntenyFeatureDetail = observer(function (props: {
  model: SyntenyFeatureDetailModel
}) {
  const { model } = props
  const { featureData } = model
  const feat = structuredClone(featureData)
  return (
    <Paper>
      <FeatureDetails
        {...props}
        feature={feat}
        formatter={value => <Formatter value={value} />}
      />
      <BaseCard title="Link to view">
        <LinkToSyntenyView model={model} />
      </BaseCard>
    </Paper>
  )
})

export default SyntenyFeatureDetail
