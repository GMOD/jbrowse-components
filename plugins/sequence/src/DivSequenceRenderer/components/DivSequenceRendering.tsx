/* eslint curly:error*/
import { readConfObject } from '@jbrowse/core/configuration'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { contrastingTextColor } from '@jbrowse/core/util/color'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { Region } from '@jbrowse/core/util/types'
import { useTheme } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import React, { useRef, useEffect } from 'react'
import { bpSpanPx } from '@jbrowse/core/util'

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
  while (sequence.length < len) {
    sequence += ' '
  }

  for (const f of features.values()) {
    const seq = f.get('residues') || f.get('seq')
    if (seq) {
      sequence = replaceAt(sequence, f.get('start') - region.start, seq)
    }
  }
  return sequence
}

interface MyProps {
  features: Map<string, Feature>
  regions: Region[]
  bpPerPx: number
  config: AnyConfigurationModel
  highResolutionScaling: number
}

function SequenceDivs(props: MyProps) {
  const { features, highResolutionScaling, regions, bpPerPx } = props
  const [region] = regions
  const width = (region.end - region.start) / bpPerPx
  const totalHeight = 40
  const height = 20

  const ref = useRef<HTMLCanvasElement>(null)

  let s = ''
  for (const seq of features.values()) {
    const seqString = seq.get('seq')
    if (!seqString || seqString.length !== seq.get('end') - seq.get('start')) {
      throw new Error(
        `feature ${seq.id()} did not contain a valid \`seq\` attribute ${
          seqString
            ? `seq length ${seq.get('end') - seq.get('start')} did not match ${
                seqString.length
              }`
            : 'seq did not exist'
        }`,
      )
    }
    if (seqString) {
      s += seq.get('seq')
    }
  }
  let letters = s.split('')
  if (region.reversed) {
    letters = letters.reverse()
  }

  useEffect(() => {
    if (!ref.current) {
      return
    }
    const ctx = ref.current.getContext('2d')
    if (!ctx) {
      return
    }

    const [leftPx, rightPx] = bpSpanPx(
      region.start,
      region.end,
      region,
      bpPerPx,
    )
    ctx.font = '20px Courier New,monospace'
    const charSize = ctx.measureText('A')
    const w = Math.max((rightPx - leftPx) / letters.length, 0.8)
    ctx.strokeStyle = 'black'
    for (let i = 0; i < letters.length; i++) {
      const letter = letters[i]

      switch (letter.toLowerCase()) {
        case 'a':
          ctx.fillStyle = '#00bf00'
          break
        case 'g':
          ctx.fillStyle = '#ffa500'
          break
        case 'c':
          ctx.fillStyle = '#4747ff'
          break
        case 't':
          ctx.fillStyle = '#f00'
          break
      }
      ctx.fillRect(leftPx + i * w, 0, w, height)
      if (1 / bpPerPx >= charSize.width) {
        ctx.strokeRect(leftPx + i * w, 0, w, height)
      }
    }
    if (1 / bpPerPx >= charSize.width) {
      ctx.fillStyle = 'black'
      for (let i = 0; i < letters.length; i++) {
        const letter = letters[i]
        ctx.fillText(letter, leftPx + i * w + (w - charSize.width) / 2, 15)
      }
    }
  }, [])
  return (
    <canvas
      ref={ref}
      width={width}
      height={totalHeight}
      style={{ width, height: totalHeight }}
    />
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
