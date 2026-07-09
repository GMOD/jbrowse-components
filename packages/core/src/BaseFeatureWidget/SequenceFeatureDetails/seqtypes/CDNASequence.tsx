import { observer } from 'mobx-react'

import { cdsColor, updownstreamColor, utrColor } from '../consts.ts'
import { computeCoordProps, getIntronDisplayStr } from '../util.ts'
import {
  flankSegment,
  renderSequenceSegments,
} from './renderSequenceSegments.tsx'

import type { SeqSegment } from './renderSequenceSegments.tsx'
import type { SimpleFeatureSerialized } from '../../../util/index.ts'
import type { Feat } from '../../util.tsx'
import type { SequenceFeatureDetailsModel } from '../model.ts'

const CDNASequence = observer(function CDNASequence({
  utr,
  cds,
  exons,
  sequence,
  upstream,
  downstream,
  feature,
  includeIntrons,
  collapseIntron,
  model,
}: {
  utr: Feat[]
  cds: Feat[]
  exons: Feat[]
  sequence: string
  upstream?: string
  downstream?: string
  feature: SimpleFeatureSerialized
  includeIntrons?: boolean
  collapseIntron?: boolean
  model: SequenceFeatureDetailsModel
}) {
  const { upperCaseCDS, intronBp, showCoordinatesSetting } = model
  const hasCds = cds.length > 0
  const chunks = (
    hasCds ? [...cds, ...utr].sort((a, b) => a.start - b.start) : exons
  ).filter(f => f.start !== f.end)
  const toLower = (s: string) => (upperCaseCDS ? s.toLowerCase() : s)
  const toUpper = (s: string) => (upperCaseCDS ? s.toUpperCase() : s)

  const { mult, coordStart } = computeCoordProps(
    feature,
    showCoordinatesSetting === 'genomic' && !!includeIntrons && !collapseIntron,
    upstream,
  )

  const middle: SeqSegment[] = []
  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx]!
    const s = sequence.slice(chunk.start, chunk.end)
    const isCds = chunk.type === 'CDS'
    middle.push({
      key: `${chunk.start}-${chunk.end}-${chunk.type}-mid`,
      // uppercase CDS (and whole-exon chunks when there's no CDS); lowercase UTR
      str: isCds || !hasCds ? toUpper(s) : toLower(s),
      color: isCds ? cdsColor : utrColor,
    })

    const intron = sequence.slice(chunk.end, chunks[idx + 1]?.start)
    if (intron && includeIntrons && idx < chunks.length - 1) {
      middle.push({
        key: `${chunk.start}-${chunk.end}-${chunk.type}-intron`,
        str: toLower(
          getIntronDisplayStr(intron, intronBp, collapseIntron ?? false),
        ),
      })
    }
  }

  return (
    <>
      {renderSequenceSegments({
        model,
        mult,
        coordStart,
        segments: [
          ...flankSegment('upstream', upstream, updownstreamColor, toLower),
          ...middle,
          ...flankSegment('downstream', downstream, updownstreamColor, toLower),
        ],
      })}
    </>
  )
})

export default CDNASequence
