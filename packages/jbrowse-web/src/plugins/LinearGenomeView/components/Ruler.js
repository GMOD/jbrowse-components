import React, { Fragment } from 'react'
import ReactPropTypes from 'prop-types'
import classnames from 'classnames'
import { PropTypes } from '../../../mst-types'

/**
 * Given a scale ( bp/px ) and minimum distances (px) between major
 * and minor gridlines, return an object like { majorPitch: bp,
 * minorPitch: bp } giving the gridline pitches to use.
 */
function chooseGridPitch(scale, minMajorPitchPx, minMinorPitchPx) {
  scale = Math.abs(scale)
  const minMajorPitchBp = minMajorPitchPx * scale
  const majorMagnitude = parseInt(
    Number(minMajorPitchBp)
      .toExponential()
      .split(/e/i)[1],
    10,
  )

  let majorPitch = 10 ** majorMagnitude
  while (majorPitch < minMajorPitchBp) {
    majorPitch *= 2
    if (majorPitch >= minMajorPitchBp) break
    majorPitch *= 2.5
  }

  const majorPitchPx = majorPitch / scale

  let minorPitch = 0
  if (!(majorPitch % 10) && majorPitchPx / 10 > minMinorPitchPx) {
    minorPitch = majorPitch / 10
  } else if (!(majorPitch % 5) && majorPitchPx / 5 > minMinorPitchPx) {
    minorPitch = majorPitch / 5
  } else if (!(majorPitch % 2) && majorPitchPx / 2 > minMinorPitchPx) {
    minorPitch = majorPitch / 2
  }

  return { majorPitch, minorPitch }
}

export function* makeTicks(
  region,
  bpPerPx,
  flipped = false,
  emitMajor = true,
  emitMinor = true,
) {
  const gridPitch = chooseGridPitch(bpPerPx, 60, 15)

  let minBase = region.start
  let maxBase = region.end
  if (minBase === null || maxBase === null) return

  if (bpPerPx < 0 || flipped) {
    ;[minBase, maxBase] = [maxBase, minBase]
  }

  // add 10px additional on the right to allow for
  // labels sitting a little leftward
  maxBase += Math.abs(10 * bpPerPx) + 1

  const iterPitch = gridPitch.minorPitch || gridPitch.majorPitch
  let index = 0
  for (
    let base = Math.ceil(minBase / iterPitch) * iterPitch;
    base < maxBase;
    base += iterPitch
  ) {
    if (emitMinor && base % gridPitch.majorPitch) {
      yield { type: 'minor', base: base - 1, index }
      index += 1
    } else if (emitMajor) {
      yield { type: 'major', base: base - 1, index }
      index += 1
    }
  }
}

export default function Ruler(props) {
  const { region, bpPerPx, flipped, major, minor, showRefSeqLabel } = props
  const ticks = []
  const labels = []
  for (const tick of makeTicks(region, bpPerPx, flipped, major, minor)) {
    const x = (tick.base - region.start) / bpPerPx
    ticks.push(
      <line
        key={tick.base}
        x1={x}
        x2={x}
        y1={0}
        y2={tick.type === 'major' ? 6 : 4}
        strokeWidth={1}
        stroke={tick.type === 'major' ? '#555' : '#999'}
        className={`tick ${tick.type}`}
        data-bp={tick.base}
      />,
    )

    if (tick.type === 'major')
      labels.push(
        <text
          x={x - 3}
          y={7}
          key={`label-${tick.base}`}
          alignmentBaseline="hanging"
          style={{ fontSize: '11px' }}
          className={classnames('label', tick.index === 0 && 'first')}
        >
          {(Number(tick.base) + 1).toLocaleString()}
        </text>,
      )
  }

  const refSeqLabels = []
  if (showRefSeqLabel && region.refName) {
    refSeqLabels.push(
      <Fragment key="refseq-label">
        <rect
          x={0}
          y={2}
          width={9 * region.refName.length}
          height="17"
          style={{ fill: 'white' }}
        />
        <text
          x={0}
          y={2}
          alignmentBaseline="hanging"
          style={{ fontSize: '16px', fontWeight: 'bold' }}
          className={classnames('label', 'refseq')}
        >
          {region.refName}
        </text>
      </Fragment>,
    )
  }

  // svg painting is based on the document order,
  // so the labels need to come after the ticks in the
  // doc, so that they draw over them.
  return [...ticks, ...labels, ...refSeqLabels]
}

Ruler.propTypes = {
  region: PropTypes.Region.isRequired,
  bpPerPx: ReactPropTypes.number.isRequired,
  flipped: ReactPropTypes.bool,
  major: ReactPropTypes.bool,
  minor: ReactPropTypes.bool,
}

Ruler.defaultProps = {
  flipped: false,
  major: true,
  minor: true,
}
