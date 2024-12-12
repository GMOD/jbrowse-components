import { observer } from 'mobx-react'

import { toLocale } from '../../util'

import type { SequenceFeatureDetailsModel } from './model'
import type { SimpleFeatureSerialized } from '../../util'

function getStrand(strand: number) {
  if (strand === -1) {
    return '(-)'
  } else if (strand === 1) {
    return '(+)'
  } else {
    return ''
  }
}

const SequenceName = observer(function ({
  mode,
  model,
  feature,
}: {
  model: SequenceFeatureDetailsModel
  mode: string
  feature: SimpleFeatureSerialized
}) {
  return (
    <div style={{ background: 'white' }}>
      {`>${[
        [feature.name || feature.id, mode].filter(f => !!f).join('-'),
        `${feature.refName}:${toLocale(feature.start + 1)}-${toLocale(feature.end)}${getStrand(feature.strand as number)}`,
        mode.endsWith('updownstream')
          ? `+/- ${toLocale(model.upDownBp)} up/downstream bp`
          : '',
      ]
        .filter(f => !!f)
        .join(' ')}\n`}
    </div>
  )
})

export default SequenceName
