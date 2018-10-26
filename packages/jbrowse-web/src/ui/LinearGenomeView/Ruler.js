import React, { Component } from 'react'
import PropTypes from 'prop-types'

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

function forEachTickMark(block, majorCallback, minorCallback) {
  const projectionBlock = block.getProjectionBlock()
  const aRange = projectionBlock.getValidRangeA()
  const scale = projectionBlock.getScale()
  const blockDims = block.getDims()

  const gridPitch = Ruler.chooseGridPitch(scale, 60, 15)

  let minBase = projectionBlock.projectPoint(blockDims.l)
  let maxBase = projectionBlock.projectPoint(blockDims.r)
  if (minBase === null || maxBase === null) return

  if (scale < 0) {
    // swap if negative
    const tmp = minBase
    minBase = maxBase
    maxBase = tmp
  }

  // apply left and right margins
  if (scale > 0) {
    if (blockDims.leftEdge) minBase += Math.abs(10 * scale)
    if (blockDims.rightEdge) maxBase -= Math.abs(10 * scale)
  } else {
    if (blockDims.rightEdge) minBase += Math.abs(10 * scale)
    if (blockDims.leftEdge) maxBase -= Math.abs(10 * scale)
  }

  const iterPitch = gridPitch.minorPitch || gridPitch.majorPitch
  for (
    let b = Math.ceil(minBase / iterPitch) * iterPitch;
    b < maxBase;
    b += iterPitch
  ) {
    if (minorCallback && b % gridPitch.majorPitch) minorCallback(b)
    else if (majorCallback) majorCallback(b)
  }
}

export default function Ruler(props) {
    
}
