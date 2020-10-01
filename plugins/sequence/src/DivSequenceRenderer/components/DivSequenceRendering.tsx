import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { AnyConfigurationModel } from '@gmod/jbrowse-core/configuration/configurationSchema'
import { contrastingTextColor } from '@gmod/jbrowse-core/util/color'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { Region } from '@gmod/jbrowse-core/util/types'
import { useTheme } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import React from 'react'
import { blue, green, red, yellow } from '@material-ui/core/colors'

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
  const theme = useTheme()
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
      {letters.map((letter, iter) => {
        const style: React.CSSProperties = {
          textAlign: 'center',
          display: 'inline-block',
          height: '100%',
          overflow: 'hidden',
          minHeight: 16,
          flex: 1,
          backgroundColor: theme.palette.action.disabled,
          color: theme.palette.text.primary,
        }
        const showLetter = bpPerPx < 0.1
        if (showLetter) {
          style.border = `1px solid ${theme.palette.divider}`
          style.borderRadius = theme.shape.borderRadius
          style.boxSizing = 'border-box'
          style.borderCollapse = 'collapse'
        }
        const dark = theme.palette.type === 'dark'
        switch (letter.toLocaleLowerCase()) {
          case 'a': {
            const baseColor = green[dark ? '300' : '500']
            style.backgroundColor = baseColor
            style.color = contrastingTextColor(baseColor)
            break
          }
          case 'g': {
            const baseColor = yellow[dark ? '300' : '800']
            style.backgroundColor = baseColor
            style.color = contrastingTextColor(baseColor)
            break
          }
          case 'c': {
            const baseColor = blue[dark ? '300' : '500']
            style.backgroundColor = baseColor
            style.color = contrastingTextColor(baseColor)
            break
          }
          case 't': {
            const baseColor = red[dark ? '300' : '500']
            style.backgroundColor = baseColor
            style.color = contrastingTextColor(baseColor)
            break
          }
          default:
            break
        }
        return (
          <div key={`${region.start}-${iter}`} style={style}>
            {showLetter ? letter : ''}
          </div>
        )
      })}
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
      // className="DivSequenceRendering"
      style={{ height: `${height}px`, fontSize: `${height * 0.8}px` }}
    >
      <SequenceDivs {...props} />
    </div>
  )
}

export default observer(DivSequenceRendering)
