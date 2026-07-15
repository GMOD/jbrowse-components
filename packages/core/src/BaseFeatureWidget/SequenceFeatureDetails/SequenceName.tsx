import { observer } from 'mobx-react'

import { modeHasUpDownstream } from './featureTypeUtil.ts'
import { toLocale } from '../../util/index.ts'
import { getStrandStr } from '../util.tsx'

import type {
  SequenceDisplayMode,
  SequenceFeatureDetailsModel,
} from './model.ts'
import type { SimpleFeatureSerialized } from '../../util/index.ts'

const SequenceName = observer(function SequenceName({
  mode,
  model,
  feature,
}: {
  model: SequenceFeatureDetailsModel
  mode: SequenceDisplayMode
  feature: SimpleFeatureSerialized
}) {
  return (
    <div>
      {`>${[
        [feature.name || feature.id, mode].filter(Boolean).join('-'),
        `${feature.refName}:${toLocale(feature.start + 1)}-${toLocale(feature.end)}${getStrandStr(feature.strand)}`,
        modeHasUpDownstream(mode)
          ? `+/- ${toLocale(model.upDownBp)} up/downstream bp`
          : '',
      ]
        .filter(Boolean)
        .join(' ')}\n`}
    </div>
  )
})

export default SequenceName
