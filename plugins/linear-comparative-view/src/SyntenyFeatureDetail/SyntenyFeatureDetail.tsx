import {
  FeatureDetailsFrame,
  FeatureDetailsPanel,
} from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
import { observer } from 'mobx-react'

import LinkToSyntenyView from './LinkToSyntenyView.tsx'

import type { SyntenyFeatureDetailModel } from './types.ts'

const SyntenyFeatureDetail = observer(function SyntenyFeatureDetail({
  model,
}: {
  model: SyntenyFeatureDetailModel
}) {
  return (
    <FeatureDetailsFrame model={model}>
      {(feature, raw) => (
        <FeatureDetailsPanel
          model={model}
          feature={feature}
          unformatted={raw}
          after={<LinkToSyntenyView model={model} feat={raw} />}
        />
      )}
    </FeatureDetailsFrame>
  )
})

export default SyntenyFeatureDetail
