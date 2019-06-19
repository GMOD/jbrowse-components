import { withStyles } from '@material-ui/core/styles'
import React, { Fragment } from 'react'
import ReactPropTypes from 'prop-types'
import { PropTypes } from '@gmod/jbrowse-core/mst-types'

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

const styles = (/* theme */) => ({
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
  refNameLabel: {
    fontSize: '16px',
    fontWeight: 'bold',
    // fill: theme.palette.text.primary,
  },
  refNameLabelBackground: {
    fontSize: '16px',
    fontWeight: 'bold',
    fill: 'white',
    // fill: theme.palette.background.default,
    fillOpacity: 0.75,
    filter: 'url(#dilate)',
  },
})

function Ruler(props) {
  const {
    region,
    bpPerPx,
    flipped,
    major,
    minor,
    showRefNameLabel,
    classes,
  } = props
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

  const refNameLabels = []
  if (showRefNameLabel && region.refName) {
    refNameLabels.push(
      <Fragment key="refname-label">
        <g>
          <defs>
            <filter id="dilate">
              <feMorphology operator="dilate" radius="5" />
            </filter>
          </defs>
          <text
            x={0}
            y={2}
            alignmentBaseline="hanging"
            className={classes.refNameLabelBackground}
          >
            {region.refName}
          </text>
          <text
            x={0}
            y={2}
            alignmentBaseline="hanging"
            className={classes.refNameLabel}
          >
            {region.refName}
          </text>
        </g>
      </Fragment>,
    )
  }

  // svg painting is based on the document order,
  // so the labels need to come after the ticks in the
  // doc, so that they draw over them.
  return [...ticks, ...labels, ...refNameLabels]
}

Ruler.propTypes = {
  classes: ReactPropTypes.objectOf(ReactPropTypes.string).isRequired,
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

export default withStyles(styles)(Ruler)
