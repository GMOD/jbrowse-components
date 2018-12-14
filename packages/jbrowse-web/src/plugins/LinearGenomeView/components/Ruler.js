import React from 'react'
import ReactPropTypes from 'prop-types'
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

function* makeTicks(
  region,
  bpPerPx,
  flipped,
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

  // apply left and right margins
  if (bpPerPx > 0) {
    if (region.leftEdge) minBase += Math.abs(10 * bpPerPx)
    if (region.rightEdge) maxBase -= Math.abs(10 * bpPerPx)
  } else {
    if (region.rightEdge) minBase += Math.abs(10 * bpPerPx)
    if (region.leftEdge) maxBase -= Math.abs(10 * bpPerPx)
  }

  const iterPitch = gridPitch.minorPitch || gridPitch.majorPitch
  for (
    let base = Math.ceil(minBase / iterPitch) * iterPitch;
    base < maxBase;
    base += iterPitch
  ) {
    if (emitMinor && base % gridPitch.majorPitch) yield { type: 'minor', base }
    else if (emitMajor) yield { type: 'major', base }
  }
}

export default function Ruler(props) {
  const { region, bpPerPx, flipped, major, minor } = props
  const ticks = []
  for (const tick of makeTicks(region, bpPerPx, flipped, major, minor)) {
    ticks.push(
      <div
        key={tick.base}
        style={{ left: `${(tick.base - region.start) / bpPerPx}px` }}
        className={`tick ${tick.type}`}
        data-bp={tick.base}
      />,
    )
  }

  return <div className="Ruler">{ticks}</div>
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
