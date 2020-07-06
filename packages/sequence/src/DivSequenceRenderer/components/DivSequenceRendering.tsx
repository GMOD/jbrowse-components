import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { Region } from '@gmod/jbrowse-core/util/types'
import { observer } from 'mobx-react'
import React from 'react'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { AnyConfigurationModel } from '@gmod/jbrowse-core/configuration/configurationSchema'

// given the displayed region and a Map of id => feature, assemble the region's
// sequence from the sequences returned by each feature.
export function featuresToSequence(
  region: Region,
  features: Map<string, Feature>,
) {
  // insert the `replacement` string into `str` at the given
  // `offset`, putting in `length` characters.
  function replaceAt(str: string, offset: number, replacement: string) {
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

interface MyProps {
  features: Map<string, Feature>
  regions: Region[]
  bpPerPx: number
  config: AnyConfigurationModel
}

function SequenceDivs({ features, regions, bpPerPx }: MyProps) {
  const [region] = regions
  let s = ''
  for (const seq of features.values()) {
    const seqString = seq.get('seq')
    if (!seqString || seqString.length !== seq.get('end') - seq.get('start'))
      throw new Error(
        `feature ${seq.id()} did not contain a valid \`seq\` attribute ${
          seqString
            ? `seq length ${seq.get('end') - seq.get('start')} did not match ${
                seqString.length
              }`
            : 'seq did not exist'
        }`,
      )
    if (seqString) s += seq.get('seq')
  }
  let letters = s.split('')
  if (region.reversed) letters = letters.reverse()

  return (
    <div style={{ display: 'flex' }}>
      {letters.map((letter, iter) => (
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

SequenceDivs.defaultProps = {
  features: new Map(),
}

function DivSequenceRendering(props: MyProps) {
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

export default observer(DivSequenceRendering)
