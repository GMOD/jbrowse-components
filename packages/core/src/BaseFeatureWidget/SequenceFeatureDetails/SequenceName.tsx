import { observer } from 'mobx-react'

import { coarseStripHTML, toLocale } from '../../util/index.ts'
import { getStrandStr } from '../util.ts'
import { sequenceModes } from './sequenceModes.ts'

import type { SimpleFeatureSerialized } from '../../util/index.ts'
import type {
  SequenceDisplayMode,
  SequenceFeatureDetailsModel,
} from './model.ts'

const SequenceName = observer(function SequenceName({
  mode,
  model,
  revcomp,
  feature,
}: {
  model: SequenceFeatureDetailsModel
  mode: SequenceDisplayMode
  revcomp: boolean
  feature: SimpleFeatureSerialized
}) {
  return (
    <div>
      {`>${[
        [
          coarseStripHTML(`${feature.name || feature.id || ''}`),
          mode,
          revcomp && sequenceModes[mode].revcomp ? 'revcomp' : '',
        ]
          .filter(Boolean)
          .join('-'),
        `${feature.refName}:${toLocale(feature.start + 1)}-${toLocale(feature.end)}${getStrandStr(feature.strand)}`,
        sequenceModes[mode].upDownstream
          ? `+/- ${toLocale(model.upDownBp)} up/downstream bp`
          : '',
      ]
        .filter(Boolean)
        .join(' ')}\n`}
    </div>
  )
})

export default SequenceName
