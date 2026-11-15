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
    <FeatureDetailsFrame
      model={model}
      renderBody={(feature, raw) => (
        <FeatureDetailsPanel
          model={model}
          feature={feature}
          unformatted={raw}
          after={<LinkToSyntenyView model={model} feat={raw} />}
        />
      )}
    />
  )
})

export default SyntenyFeatureDetail
