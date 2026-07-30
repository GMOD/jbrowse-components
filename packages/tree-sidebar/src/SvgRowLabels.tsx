import { getFillProps, max, measureText } from '@jbrowse/core/util'
import { alpha, useTheme } from '@mui/material'

// Below this a label's text is illegible, so the row draws as a color swatch
// only. It is not a gate on drawing anything at all: a clustered track can sit
// at a fraction of a pixel a row (1,987 canids in 640px is 0.32px) and the tint
// is still the only thing carrying row identity there, so it has to survive.
const MIN_TEXT_ROW_HEIGHT = 6
const SWATCH_WIDTH = 8

interface Source {
  name: string
  label?: string
  labelColor?: string
}

// Consecutive rows sharing a color paint as one rect. At sub-pixel row heights
// the alternative is a rect per row -- 1,987 DOM nodes re-rendered on every
// scroll, each an antialiased sliver -- and because clustering puts like rows
// next to each other, the runs are exactly the blocks a reader is meant to see.
// Visually identical either way: the rects are contiguous and same-filled.
// Rows with no color contribute nothing, so a partly-colored track draws gaps
// rather than a run bridging them.
function colorRuns(sources: Source[]) {
  const runs: { start: number; end: number; color: string; key: string }[] = []
  for (const [idx, source] of sources.entries()) {
    const color = source.labelColor
    if (color !== undefined) {
      const last = runs.at(-1)
      if (last?.end === idx && last.color === color) {
        last.end = idx + 1
      } else {
        runs.push({ start: idx, end: idx + 1, color, key: source.name })
      }
    }
  }
  // Longest first, so the shortest runs paint last and a rare mark is never
  // buried by a common one. Once a run is floored to a pixel it is taller than
  // the rows it covers, so a later rect overdraws its neighbour -- in row order
  // that silently costs the minority group (307 village dogs erased 40% of the
  // 63 wolves interleaved with them, which is exactly the group the stripe
  // exists to find). Painting order is the only thing this changes; every rect
  // keeps its true `y`.
  return runs.sort((a, b) => b.end - b.start - (a.end - a.start))
}

export function SvgRowLabels({
  sources,
  rowHeight,
  labelOffset,
  scrollTop = 0,
  availableHeight,
}: {
  sources: Source[]
  rowHeight: number
  labelOffset: number
  scrollTop?: number
  availableHeight?: number
}) {
  const theme = useTheme()
  const fontSize = Math.min(rowHeight, 12)
  const boxHeight = Math.min(rowHeight, 20)
  const defaultBackground = alpha(theme.palette.background.paper, 0.8)
  const textFits = rowHeight >= MIN_TEXT_ROW_HEIGHT
  // Without a tint there is nothing left once the text is gone, so a track whose
  // rows carry no color draws nothing rather than a bare stripe of the default
  // background.
  const runs = textFits ? [] : colorRuns(sources)

  function offscreen(y: number, height: number) {
    return (
      availableHeight !== undefined && (y + height < 0 || y > availableHeight)
    )
  }

  // `name` is the identity (key + hit-test); `label` is the displayed string if
  // the adapter config supplied one.
  const boxWidth = textFits
    ? max(
        sources.map(s => measureText(s.label ?? s.name, fontSize) + 10),
        10,
      )
    : SWATCH_WIDTH

  return textFits ? (
    <g transform={`translate(${labelOffset} 0)`}>
      {sources.map((source, idx) => {
        const y = idx * rowHeight - scrollTop
        // Per-source labelColor tints the label box (identity coding for
        // multirow/density tracks); text auto-contrasts against it.
        const lc = source.labelColor
        const fg = lc
          ? theme.palette.getContrastText(lc)
          : theme.palette.text.primary
        return offscreen(y, rowHeight) ? null : (
          <g key={source.name}>
            <rect
              x={0}
              y={y}
              width={boxWidth}
              height={boxHeight}
              {...getFillProps(lc ?? defaultBackground)}
            />
            <text
              x={4}
              y={y + boxHeight / 2}
              fontSize={fontSize}
              dominantBaseline="central"
              {...getFillProps(fg)}
            >
              {source.label ?? source.name}
            </text>
          </g>
        )
      })}
    </g>
  ) : runs.length ? (
    <g transform={`translate(${labelOffset} 0)`}>
      {runs.map(run => {
        const y = run.start * rowHeight - scrollTop
        // Floored at a pixel: the swatch is a marker pointing at rows, not a
        // measurement of their extent, and a 0.32px rect antialiases to nothing.
        // `y` stays exact, so a mark never moves off the row it belongs to — it
        // can only overdraw its neighbour, which reads as "mixed here" and is
        // true. The painting itself keeps sub-pixel honesty; this is the index.
        const height = Math.max((run.end - run.start) * rowHeight, 1)
        return offscreen(y, height) ? null : (
          <rect
            key={run.key}
            x={0}
            y={y}
            width={boxWidth}
            height={height}
            {...getFillProps(run.color)}
          />
        )
      })}
    </g>
  ) : null
}
