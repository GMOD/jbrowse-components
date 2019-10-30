import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { PropTypes as CommonPropTypes } from '@gmod/jbrowse-core/mst-types'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React from 'react'
import './DivSequenceRendering.scss'

// given the displayed region and a Map of id => feature, assemble the region's
// sequence from the sequences returned by each feature.
export function featuresToSequence(region, features) {
  // insert the `replacement` string into `str` at the given
  // `offset`, putting in `length` characters.
  function replaceAt(str, offset, replacement) {
    let rOffset = 0
    if (offset < 0) {
      rOffset = -offset
      offset = 0
    }

    const length = Math.min(str.length - offset, replacement.length - rOffset)

    return (
      str.substr(0, offset) +
      replacement.substr(rOffset, length) +
      str.substr(offset + length)
    )
  }

  // pad with spaces at the beginning of the string if necessary
  const len = region.end - region.start
  let sequence = ''
  while (sequence.length < len) sequence += ' '

  for (const f of features.values()) {
    const seq = f.get('residues') || f.get('seq')
    if (seq) sequence = replaceAt(sequence, f.get('start') - region.start, seq)
  }
  return sequence
}

function SequenceDivs({ features, region, bpPerPx, horizontallyFlipped }) {
  let s = ''
  for (const seq of features.values()) {
    const seqString = seq.get('seq')
    if (!seqString || seqString.length !== seq.get('end') - seq.get('start'))
      throw new Error(
        `feature ${seq.id()} did not contain a valid \`seq\` attribute`,
      )
    if (seqString) s += seq.get('seq')
  }

  s = s.split('')
  if (horizontallyFlipped) s = s.reverse()

  return (
    <div style={{ display: 'flex' }}>
      {s.map((letter, iter) => (
        <div
          key={`${region.start}-${iter}`}
          className={`base base-${letter.toLowerCase()} ${
            bpPerPx < 0.1 ? 'border' : ''
          }`}
        >
          {bpPerPx < 0.1 ? letter : ''}
        </div>
      ))}
    </div>
  )
}

SequenceDivs.propTypes = {
  region: CommonPropTypes.Region.isRequired,
  bpPerPx: ReactPropTypes.number.isRequired,
  features: ReactPropTypes.instanceOf(Map),
  horizontallyFlipped: ReactPropTypes.bool,
}
SequenceDivs.defaultProps = {
  features: new Map(),
  horizontallyFlipped: false,
}

function DivSequenceRendering(props) {
  const { config } = props
  const height = readConfObject(config, 'height')
  return (
    <div
      className="DivSequenceRendering"
      style={{ height: `${height}px`, fontSize: `${height * 0.8}px` }}
    >
      <SequenceDivs {...props} />
    </div>
  )
}
DivSequenceRendering.propTypes = {
  config: CommonPropTypes.ConfigSchema.isRequired,
  bpPerPx: ReactPropTypes.number.isRequired,
}

export default observer(DivSequenceRendering)
