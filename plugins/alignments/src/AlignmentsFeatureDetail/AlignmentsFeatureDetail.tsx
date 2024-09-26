import React, { lazy } from 'react'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'
import clone from 'clone'
import { FeatureDetails } from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'

// locals
import { getTag } from './util'
import { tags } from './tagInfo'
import { AlignmentFeatureWidgetModel } from './stateModelFactory'

// local components
import Flags from './Flags'
import PairLink from './PairLink'
import Formatter from './Formatter'
import { parseCigar } from '../MismatchParser'

// lazies
const SupplementaryAlignments = lazy(() => import('./SupplementaryAlignments'))
const LinkedPairedAlignments = lazy(() => import('./LinkedPairedAlignments'))

const omit = ['clipPos', 'flags']

function CigarSeqDisplayer({ seq, cigar }: { seq: string; cigar: string }) {
  const opts = parseCigar(cigar)
  let qpos = 0 // query position, position on the read
  let tpos = 0 // target position, position on the reference sequence
  const refSeq = ''
  const readSeq = seq
  const ret = []

  // opts will be an array like this ['30','M', '2','I', '50','M', '40','D']
  // which we parse two elements at a time
  for (let i = 0; i < opts.length; i += 2) {
    const len = +opts[i]!
    const op = opts[i + 1]!
    // do things. refer to the CIGAR chart in SAMv1.pdf for which operators
    // "consume reference" to see whether to increment
    if (op === 'M' || op === '=') {
      // matches consume query and reference
      const refMatch = refSeq.slice(tpos, tpos + len)
      const readMatch = readSeq.slice(qpos, qpos + len)
      for (let i = 0; i < len; i++) {
        if (refMatch[i] !== readMatch[i]) {
          // SNP at this position
        }
      }
      qpos += len
      tpos += len
      ret.push(<span style={{ color: 'grey' }}>{readMatch}</span>)
    }
    if (op === 'I') {
      // insertions only consume query
      // sequence of the insertion from the read is
      const insSeq = readSeq.slice(qpos, qpos + len)
      qpos += len
      ret.push(<span style={{ color: '#f00c' }}>{insSeq}</span>)
    }
    if (op === 'D') {
      // deletions only consume reference
      // sequence of the deletion from the reference is
      const delSeq = refSeq.slice(tpos, tpos + len)
      tpos += len
      ret.push(<span style={{ color: '#00fc' }}>(DEL{len})</span>)
    }
    if (op === 'N') {
      // skips only consume reference
      // skips are similar to deletions but are related to spliced alignments
      tpos += len
      ret.push(<span style={{ color: '#0ffc' }}>(SKIP{len})</span>)
    }
    if (op === 'X') {
      // mismatch using the extended CIGAR format
      // could lookup the mismatch letter in a string containing the reference
      const mismatch = refSeq.slice(tpos, tpos + len)
      qpos += len
      tpos += len
      ret.push(<span style={{ color: '#0f0c' }}>{mismatch}</span>)
    }
    if (op === 'H') {
      // does not consume query or reference
      // hardclip is just an indicator
    }
    if (op === 'S') {
      // softclip consumes query
      // below gets the entire soft clipped portion
      const softClipStr = readSeq.slice(qpos, qpos + len)
      qpos += len
      ret.push(<span style={{ color: '#880c' }}>{softClipStr}</span>)
    }
  }
  return <div>{ret}</div>
}

const AlignmentsFeatureDetails = observer(function (props: {
  model: AlignmentFeatureWidgetModel
}) {
  const { model } = props
  const { featureData } = model
  const feat = clone(featureData)
  const SA = getTag('SA', feat) as string | undefined
  const { flags } = feat
  return (
    <Paper data-testid="alignment-side-drawer">
      <FeatureDetails
        {...props}
        omit={omit}
        // @ts-expect-error
        descriptions={{ ...tags, tags: tags }}
        feature={feat}
        formatter={(value, key) =>
          key === 'next_segment_position' ? (
            <PairLink model={model} locString={value as string} />
          ) : key === 'seq' ? (
            <CigarSeqDisplayer seq={value as string} cigar={feat.CIGAR} />
          ) : (
            <Formatter value={value} />
          )
        }
      />
      {SA !== undefined ? (
        <SupplementaryAlignments model={model} tag={SA} feature={feat} />
      ) : null}
      {flags & 1 ? (
        <LinkedPairedAlignments model={model} feature={feat} />
      ) : null}

      {flags !== undefined ? <Flags feature={feat} {...props} /> : null}
    </Paper>
  )
})

export default AlignmentsFeatureDetails
