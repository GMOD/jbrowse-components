import React from 'react'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'

import { PropTypes as CommonPropTypes } from '../../../mst-types'
import { readConfObject } from '../../../configuration'
import { objectFromEntries } from '../../../util'
import aminoAcids from '../aminoAcids'
import { featuresConsensusSequence, contrastingTextColor } from '../util'

function Sequence({
  getColorForLetter,
  getTitleForLetter,
  region,
  config,
  bpPerPx,
  horizontallyFlipped,
  sequence,
}) {
  let s = sequence.split('')
  if (horizontallyFlipped) s = s.reverse()
  const height = readConfObject(config, 'height')
  const letterWidth = 1 / bpPerPx
  return (
    <>
      {s.map((letter, iter) => {
        const left = iter / bpPerPx
        const fill = getColorForLetter(letter)
        return (
          <g
            /* eslint-disable-next-line */
            key={`${region.start}-${iter}`}
            transform={`translate(${left}, 0)`}
          >
            <rect
              x={0}
              y={0}
              width={letterWidth}
              height={height}
              fill={fill}
              title={getTitleForLetter(letter)}
            />
            <text
              textAnchor="middle"
              x={letterWidth / 2}
              y={height * 0.8}
              fill={contrastingTextColor(fill)}
            >
              {bpPerPx < 0.1 ? letter : ''}
            </text>
          </g>
        )
      })}
    </>
  )
}

Sequence.propTypes = {
  region: CommonPropTypes.Region.isRequired,
  bpPerPx: ReactPropTypes.number.isRequired,
  horizontallyFlipped: ReactPropTypes.bool,
}
Sequence.defaultProps = {
  features: new Map(),
  horizontallyFlipped: false,
}

/**
 * given an iterable of features, yield only those features with
 * the requested type
 *
 * @param {string} type
 * @param {Iterable[SimpleFeature]} features
 * @returns {Iterable} of features in the iterator that have the requested type
 */
function* getFeaturesOfType(type, features) {
  for (const feature of features) {
    if (feature.get('type') === type) yield feature
  }
}

const aaColors = objectFromEntries(
  aminoAcids.map(aaRecord => [aaRecord.letter, aaRecord.color]),
)
const aaNames = objectFromEntries(
  aminoAcids.map(aaRecord => [aaRecord.letter, aaRecord.fullName]),
)

function Rendering(props) {
  const { bpPerPx, config, region, features } = props
  const height = readConfObject(config, 'height')
  const widthPx = (region.end - region.start) / bpPerPx
  const proteinSequence = featuresConsensusSequence(
    region,
    getFeaturesOfType('protein', features.values()),
  )
  return (
    <svg height={height} width={widthPx} style={{ fontSize: height * 0.9 }}>
      {bpPerPx >= 1 ? (
        <text className="blur">Zoom in to see sequence</text>
      ) : (
        <Sequence
          {...props}
          sequence={proteinSequence}
          getColorForLetter={letter => aaColors[letter] || '#ffffff'}
          getTitleForLetter={letter => aaNames[letter]}
        />
      )}
    </svg>
  )
}
Rendering.propTypes = {
  config: CommonPropTypes.ConfigSchema.isRequired,
  bpPerPx: ReactPropTypes.number.isRequired,
  region: ReactPropTypes.shape({ end: ReactPropTypes.number.isRequired })
    .isRequired,
}

export default observer(Rendering)
