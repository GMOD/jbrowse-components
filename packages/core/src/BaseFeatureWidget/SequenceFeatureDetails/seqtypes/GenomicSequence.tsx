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
  useGenomicCoords,
  revcomp,
  onHoverBase,
  model,
}: {
  sequence: string
  feature: SimpleFeatureSerialized
  upstream?: string
  downstream?: string
  useGenomicCoords: boolean
  // the sequence itself is already flipped upstream of here; the flag only
  // tells the coordinate labels which direction they now run
  revcomp: boolean
  onHoverBase?: (base0: number) => void
  model: SequenceFeatureDetailsModel
}) {
  const { mult, coordStart } = computeCoordProps({
    feature,
    useGenomicCoords,
    upstream,
    revcomp,
  })
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
