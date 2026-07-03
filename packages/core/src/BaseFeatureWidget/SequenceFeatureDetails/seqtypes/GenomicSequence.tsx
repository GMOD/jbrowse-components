import { observer } from 'mobx-react'

import { genomeColor, updownstreamColor } from '../consts.ts'
import { computeCoordProps } from '../util.ts'
import { renderSequenceSegments } from './renderSequenceSegments.tsx'

import type { SimpleFeatureSerialized } from '../../../util/index.ts'
import type { SequenceFeatureDetailsModel } from '../model.ts'

const GenomicSequence = observer(function GenomicSequence({
  sequence,
  upstream,
  feature,
  downstream,
  model,
}: {
  sequence: string
  feature: SimpleFeatureSerialized
  upstream?: string
  downstream?: string
  model: SequenceFeatureDetailsModel
}) {
  const { mult, coordStart } = computeCoordProps(
    feature,
    model.showCoordinatesSetting === 'genomic',
    upstream,
  )
  return (
    <>
      {renderSequenceSegments({
        model,
        mult,
        coordStart,
        segments: [
          ...(upstream
            ? [{ key: 'upstream', str: upstream, color: updownstreamColor }]
            : []),
          { key: 'genome', str: sequence, color: genomeColor },
          ...(downstream
            ? [{ key: 'downstream', str: downstream, color: updownstreamColor }]
            : []),
        ],
      })}
    </>
  )
})

export default GenomicSequence
