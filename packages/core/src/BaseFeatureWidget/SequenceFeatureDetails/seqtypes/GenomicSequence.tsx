import { observer } from 'mobx-react'

import { genomeColor, updownstreamColor } from '../consts.ts'
import { computeCoordProps } from '../util.ts'
import {
  flankSegment,
  renderSequenceSegments,
} from './renderSequenceSegments.tsx'

import type { SimpleFeatureSerialized } from '../../../util/index.ts'
import type { SequenceFeatureDetailsModel } from '../model.ts'

const GenomicSequence = observer(function GenomicSequence({
  sequence,
  upstream,
  feature,
  downstream,
  onHoverBase,
  model,
}: {
  sequence: string
  feature: SimpleFeatureSerialized
  upstream?: string
  downstream?: string
  onHoverBase?: (base0: number) => void
  model: SequenceFeatureDetailsModel
}) {
  const useGenomicCoords = model.showCoordinatesSetting === 'genomic'
  const { mult, coordStart } = computeCoordProps(
    feature,
    useGenomicCoords,
    upstream,
  )
  return (
    <>
      {renderSequenceSegments({
        model,
        mult,
        coordStart,
        onHoverBase: useGenomicCoords ? onHoverBase : undefined,
        segments: [
          ...flankSegment('upstream', upstream, updownstreamColor),
          { key: 'genome', str: sequence, color: genomeColor },
          ...flankSegment('downstream', downstream, updownstreamColor),
        ],
      })}
    </>
  )
})

export default GenomicSequence
