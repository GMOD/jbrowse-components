import React from 'react'
import { observer } from 'mobx-react'

// locals
import { Feat } from '../../util'
import { cdsColor, intronColor, updownstreamColor, utrColor } from '../util'
import { SequenceFeatureDetailsModel } from '../model'

const CDNASequence = observer(function ({
  utr,
  cds,
  exons,
  sequence,
  upstream,
  downstream,
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
  includeIntrons?: boolean
  collapseIntron?: boolean
  model: SequenceFeatureDetailsModel
}) {
  const { upperCaseCDS, intronBp } = model
  const hasCds = cds.length > 0
  const chunks = (
    cds.length ? [...cds, ...utr].sort((a, b) => a.start - b.start) : exons
  ).filter(f => f.start !== f.end)
  const toLower = (s: string) => (upperCaseCDS ? s.toLowerCase() : s)
  const toUpper = (s: string) => (upperCaseCDS ? s.toUpperCase() : s)
  return (
    <>
      {upstream ? (
        <span style={{ background: updownstreamColor }}>
          {toLower(upstream)}
        </span>
      ) : null}

      {chunks.map((chunk, idx) => {
        const intron = sequence.slice(chunk.end, chunks[idx + 1]?.start)

        return (
          <React.Fragment key={JSON.stringify(chunk)}>
            <span
              style={{
                background: chunk.type === 'CDS' ? cdsColor : utrColor,
              }}
            >
              {hasCds
                ? chunk.type === 'CDS'
                  ? toUpper(sequence.slice(chunk.start, chunk.end))
                  : toLower(sequence.slice(chunk.start, chunk.end))
                : toUpper(sequence.slice(chunk.start, chunk.end))}
            </span>
            {includeIntrons && idx < chunks.length - 1 ? (
              <span style={{ background: intronColor }}>
                {toLower(
                  collapseIntron && intron.length > intronBp * 2
                    ? `${intron.slice(0, intronBp)}...${intron.slice(-intronBp)}`
                    : intron,
                )}
              </span>
            ) : null}
          </React.Fragment>
        )
      })}

      {downstream ? (
        <span style={{ background: updownstreamColor }}>
          {toLower(downstream)}
        </span>
      ) : null}
    </>
  )
})

export default CDNASequence
