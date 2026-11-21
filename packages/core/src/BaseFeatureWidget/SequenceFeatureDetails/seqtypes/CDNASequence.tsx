import { observer } from 'mobx-react'

import SequenceLegend from '../SequenceLegend.tsx'
import { cdsColor, updownstreamColor, utrColor } from '../consts.ts'
import {
  computeCoordProps,
  getIntronDisplayStr,
  splitRegionByCds,
  transcriptRegions,
} from '../util.ts'
import {
  flankSegment,
  renderSequenceSegments,
} from './renderSequenceSegments.tsx'

import type { SimpleFeatureSerialized } from '../../../util/index.ts'
import type { SequenceFeatureDetailsModel } from '../model.ts'
import type { Feat } from '../types.ts'
import type { SeqSegment } from './renderSequenceSegments.tsx'

const CDNASequence = observer(function CDNASequence({
  cds,
  exons,
  sequence,
  upstream,
  downstream,
  feature,
  includeIntrons,
  collapseIntron = false,
  useGenomicCoords,
  revcomp,
  onHoverBase,
  model,
}: {
  cds: Feat[]
  exons: Feat[]
  sequence: string
  upstream?: string
  downstream?: string
  feature: SimpleFeatureSerialized
  includeIntrons?: boolean
  collapseIntron?: boolean
  // label rows (and report hovers) as genomic positions rather than offsets
  // from the feature start. Mapping display index to genome linearly only holds
  // when introns are shown uncollapsed, so the caller resolves this from the
  // mode rather than reading the setting directly.
  useGenomicCoords: boolean
  // the sequence itself is already flipped upstream of here; the flag only
  // tells the coordinate labels which direction they now run
  revcomp: boolean
  onHoverBase?: (base0: number) => void
  model: SequenceFeatureDetailsModel
}) {
  const { upperCaseCDS, intronBp } = model
  const hasCds = cds.length > 0
  // upperCaseCDS capitalizes the coding sequence and lowercases everything
  // else; otherwise every stretch keeps the reference genome's own casing
  const caseCoding = (s: string) => (upperCaseCDS ? s.toUpperCase() : s)
  const caseNoncoding = (s: string) => (upperCaseCDS ? s.toLowerCase() : s)
  // a collapsed intron's tail is its own segment, so the rows after it are
  // labelled with the bases the ellipsis skipped
  const intronSegments = (key: string, intron: string): SeqSegment[] => {
    const shown = caseNoncoding(
      getIntronDisplayStr(intron, intronBp, collapseIntron),
    )
    const tailStart = shown.length - intronBp
    return shown.length === intron.length
      ? [{ key, str: shown }]
      : [
          {
            key: `${key}-head`,
            str: shown.slice(0, tailStart),
            bases: intron.length - intronBp,
          },
          { key: `${key}-tail`, str: shown.slice(tailStart) },
        ]
  }

  const { mult, coordStart } = computeCoordProps({
    feature,
    useGenomicCoords,
    upstream,
    revcomp,
  })

  // the transcript is its exons; the CDS only decides how each stretch is
  // colored and cased, so annotated UTRs are never needed
  const regions = transcriptRegions({
    cds,
    exons,
    featureLength: sequence.length,
  }).filter(f => f.start !== f.end)

  const middle: SeqSegment[] = []
  for (let idx = 0; idx < regions.length; idx++) {
    const region = regions[idx]!
    for (const { start, end, isCds } of splitRegionByCds(region, cds)) {
      const s = sequence.slice(start, end)
      middle.push({
        key: `${start}-${end}-${isCds ? 'cds' : 'utr'}`,
        // uppercase CDS (and every region of a noncoding transcript); lower UTR
        str: isCds || !hasCds ? caseCoding(s) : caseNoncoding(s),
        color: isCds ? cdsColor : utrColor,
      })
    }

    const next = regions[idx + 1]
    if (includeIntrons && next) {
      const intron = sequence.slice(region.end, next.start)
      if (intron) {
        middle.push(
          ...intronSegments(`${region.start}-${region.end}-intron`, intron),
        )
      }
    }
  }

  // The stretches of the feature its own exons do not reach (CAT/liftoff spans
  // a transcript over the source alignment but emits exons only where the CDS
  // is supported). Uncolored like an intron, since the annotation does not call
  // them exonic, and shown only by the intron modes, which run the length of
  // the feature and label coordinates from its start.
  const outside = (key: string, str: string): SeqSegment[] =>
    includeIntrons && str ? intronSegments(key, str) : []
  const first = regions[0]
  const last = regions.at(-1)

  const segments = [
    ...flankSegment('upstream', upstream, updownstreamColor, caseNoncoding),
    ...outside(
      'before-first-exon',
      first ? sequence.slice(0, first.start) : '',
    ),
    ...middle,
    ...outside('after-last-exon', last ? sequence.slice(last.end) : ''),
    ...flankSegment('downstream', downstream, updownstreamColor, caseNoncoding),
  ]

  // keyed off the colors actually emitted, so the legend can never advertise a
  // swatch that is not on screen (e.g. a transcript with no UTR). Introns are
  // deliberately absent: they are the uncolored stretches, so there is no
  // swatch to explain. A lone swatch explains nothing, hence the >1.
  const usedColors = new Set(segments.map(seg => seg.color))
  const legendItems = [
    { color: cdsColor, label: 'CDS' },
    { color: utrColor, label: hasCds ? 'UTR' : 'exon' },
    { color: updownstreamColor, label: 'up/downstream' },
  ].filter(item => usedColors.has(item.color))

  return (
    <>
      {legendItems.length > 1 ? <SequenceLegend items={legendItems} /> : null}
      {renderSequenceSegments({
        model,
        mult,
        coordStart,
        onHoverBase: useGenomicCoords ? onHoverBase : undefined,
        segments,
      })}
    </>
  )
})

export default CDNASequence
