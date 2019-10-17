import { PropTypes } from '@gmod/jbrowse-core/mst-types'
import { makeStyles } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React from 'react'

/**
 * Given a scale ( bp/px ) and minimum distances (px) between major
 * and minor gridlines, return an object like { majorPitch: bp,
 * minorPitch: bp } giving the gridline pitches to use.
 */
function chooseGridPitch(
  scale: number,
  minMajorPitchPx: number,
  minMinorPitchPx: number,
) {
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
  region: { start: number; end: number },
  bpPerPx: number,
  emitMajor = true,
  emitMinor = true,
) {
  const gridPitch = chooseGridPitch(bpPerPx, 60, 15)

  let minBase = region.start
  let maxBase = region.end
  if (minBase === null || maxBase === null) return

  if (bpPerPx < 0) {
    ;[minBase, maxBase] = [maxBase, minBase]
  }

  // add 20px additional on the right and left to allow us to draw the ends
  // of labels that lie a little outside our region
  minBase -= Math.abs(20 * bpPerPx) - 1
  maxBase += Math.abs(20 * bpPerPx) + 1

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

const useStyles = makeStyles((/* theme */) => ({
  majorTickLabel: {
    fontSize: '11px',
    // fill: theme.palette.text.primary,
  },
  majorTick: {
    stroke: '#555',
    // stroke: theme.palette.text.secondary,
  },
  minorTick: {
    stroke: '#999',
    // stroke: theme.palette.text.hint,
  },
}))

function Ruler({
  region,
  bpPerPx,
  flipped,
  major,
  minor,
}: {
  region: { start: number; end: number }
  bpPerPx: number
  flipped: boolean
  major: boolean
  minor: boolean
}) {
  const classes = useStyles()
  const ticks = []
  const labels = []
  for (const tick of makeTicks(region, bpPerPx, major, minor)) {
    const x =
      (flipped ? region.end - tick.base : tick.base - region.start) / bpPerPx
    ticks.push(
      <line
        key={tick.base}
        x1={x}
        x2={x}
        y1={0}
        y2={tick.type === 'major' ? 6 : 4}
        strokeWidth={1}
        stroke={tick.type === 'major' ? '#555' : '#999'}
        className={
          tick.type === 'major' ? classes.majorTick : classes.minorTick
        }
        data-bp={tick.base}
      />,
    )

    if (tick.type === 'major')
      labels.push(
        <text
          x={x - 3}
          y={7}
          key={`label-${tick.base}`}
          dominantBaseline="hanging"
          style={{ fontSize: '11px' }}
          className={classes.majorTickLabel}
        >
          {(Number(tick.base) + 1).toLocaleString()}
        </text>,
      )
  }

  // svg painting is based on the document order,
  // so the labels need to come after the ticks in the
  // doc, so that they draw over them.
  return <>{[...ticks, ...labels]}</>
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

export default observer(Ruler)
