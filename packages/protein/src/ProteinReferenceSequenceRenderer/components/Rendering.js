import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { PropTypes as CommonPropTypes } from '@gmod/jbrowse-core/mst-types'
import { objectFromEntries } from '@gmod/jbrowse-core/util'
import { contrastingTextColor } from '@gmod/jbrowse-core/util/color'
import SimpleFeature from '@gmod/jbrowse-core/util/simpleFeature'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React from 'react'
import aminoAcids from '../aminoAcids'
import nucleotides from '../nucleotides'
import { featuresConsensusSequence } from '../util'

function Sequence({
  getColorForLetter,
  getTitleForLetter,
  region,
  height,
  bpPerPx,
  sequence,
  lettersPerBp,
  y,
}) {
  let s = sequence.split('')
  if (region.reversed) s = s.reverse()
  const letterWidth = 1 / bpPerPx / lettersPerBp
  return (
    <g transform={`translate(0 ${y})`}>
      {s.map((letter, iter) => {
        const left = iter * letterWidth
        const fill = getColorForLetter(letter)
        return (
          <g
            key={`${region.start}-${iter}`}
            transform={`translate(${left}, 0)`}
          >
            <title>{getTitleForLetter(letter)}</title>
            <rect x={0} y={0} width={letterWidth} height={height} fill={fill} />
            {letterWidth < height * 0.8 ? null : (
              <text
                textAnchor="middle"
                x={letterWidth / 2}
                y={height * 0.8}
                fill={contrastingTextColor(fill)}
              >
                {letter}
              </text>
            )}
          </g>
        )
      })}
    </g>
  )
}

Sequence.propTypes = {
  region: CommonPropTypes.Region.isRequired,
  bpPerPx: ReactPropTypes.number.isRequired,
  y: ReactPropTypes.number,
  getTitleForLetter: ReactPropTypes.func,
  getColorForLetter: ReactPropTypes.func,
  sequence: ReactPropTypes.string.isRequired,
  height: ReactPropTypes.number.isRequired,
  lettersPerBp: ReactPropTypes.number,
}
Sequence.defaultProps = {
  y: 0,
  getTitleForLetter: () => undefined,
  getColorForLetter: () => '#ffffff',
  lettersPerBp: 1,
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

function* scaleFeatureCoordinates(scaleFactor, features) {
  for (const feature of features) {
    const json = feature.toJSON()
    json.start *= scaleFactor
    json.end *= scaleFactor
    yield new SimpleFeature(json)
  }
}
function scaleRegion(factor, region) {
  const scaled = { ...region }
  scaled.start *= factor
  scaled.end *= factor
  return scaled
}

const aaColors = objectFromEntries(
  aminoAcids.map(aaRecord => [aaRecord.letter, aaRecord.color]),
)
const aaNames = objectFromEntries(
  aminoAcids.map(aaRecord => [aaRecord.letter, aaRecord.fullName]),
)
const bpColors = objectFromEntries(
  nucleotides.map(nRecord => [nRecord.letter, nRecord.color]),
)

function Rendering(props) {
  const { bpPerPx, config, region, features } = props

  if (bpPerPx > 1) {
    return (
      <div style={{ whiteSpace: 'normal', padding: '2px' }}>
        Zoom in to see sequence
      </div>
    )
  }

  const height = readConfObject(config, 'height')
  const widthPx = (region.end - region.start) / bpPerPx
  const proteinSequence = featuresConsensusSequence(
    region,
    getFeaturesOfType('protein', features.values()),
  )

  const showDnaSequence = true
  const dnaSequence = featuresConsensusSequence(
    scaleRegion(3, region),
    scaleFeatureCoordinates(3, getFeaturesOfType('dna', features.values())),
  )

  return (
    <svg
      height={height + (showDnaSequence ? height : 0)}
      width={widthPx}
      style={{ fontSize: height * 0.9 }}
    >
      {showDnaSequence ? (
        <Sequence
          {...props}
          lettersPerBp={3}
          height={height}
          sequence={dnaSequence}
          getColorForLetter={letter => bpColors[letter] || '#ffffff'}
        />
      ) : null}
      <Sequence
        {...props}
        y={showDnaSequence ? height : 0}
        height={height}
        sequence={proteinSequence}
        getColorForLetter={letter => aaColors[letter] || '#ffffff'}
        getTitleForLetter={letter => aaNames[letter]}
      />
    </svg>
  )
}
Rendering.propTypes = {
  config: CommonPropTypes.ConfigSchema.isRequired,
  bpPerPx: ReactPropTypes.number.isRequired,
  region: ReactPropTypes.shape({
    end: ReactPropTypes.number.isRequired,
    start: ReactPropTypes.number.isRequired,
  }).isRequired,
  features: ReactPropTypes.instanceOf(Map).isRequired,
}

export default observer(Rendering)
