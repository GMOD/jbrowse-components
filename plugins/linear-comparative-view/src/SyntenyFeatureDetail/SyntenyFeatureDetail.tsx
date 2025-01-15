import BaseFeatureDetail from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'

import { Paper } from '@mui/material'
import { observer } from 'mobx-react'

import LinkToSyntenyView from './LinkToSyntenyView'

import type { SyntenyFeatureDetailModel } from './types'

const SyntenyFeatureDetail = observer(function ({
  model,
}: {
  model: SyntenyFeatureDetailModel
}) {
  return (
    <Paper>
      <BaseFeatureDetail title="Feature" model={model} />
      <BaseCard title="Link to view">
        <LinkToSyntenyView model={model} />
      </BaseCard>
    </Paper>
  )
})

export default SyntenyFeatureDetail
