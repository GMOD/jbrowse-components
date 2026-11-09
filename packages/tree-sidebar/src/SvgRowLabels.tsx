import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { alpha } from '@jbrowse/core/ui/palette'
import { getFillProps } from '@jbrowse/core/util'

import {
  ROW_SWATCH_WIDTH,
  rowColorWidth,
  rowLabelFontSize,
  rowLabelFullText,
  rowLabelText,
  rowLabelTextX,
  rowLabelsBoxWidth,
  rowLabelsCarryText,
} from './rowLabelsBoxWidth.ts'
import { rowRuns } from './rowRuns.ts'

import type { RowAnnotationColumn, RowLabelSource } from './types.ts'
import type { ExportTextStyle } from '@jbrowse/display-kit/types'

// Each annotation's consecutive rows sharing a color, as one
// `ROW_SWATCH_WIDTH` rect (`rowRuns` owns that rule and says why; a row
// with no color contributes nothing, so a column draws gaps rather than a run
// bridging them), the columns side by side from `x` on.
function annotationRuns(
  sources: RowLabelSource[],
  annotations: readonly RowAnnotationColumn[],
  x: number,
) {
  return annotations.flatMap((colors, column) =>
    rowRuns(sources, source => colors.get(source.name)).map(run => ({
      ...run,
      x: x + column * ROW_SWATCH_WIDTH,
      width: ROW_SWATCH_WIDTH,
      testId: 'row-annotation-bar',
    })),
  )
}

// The row color's runs as the swatch standing in for the label, then the
// annotation columns, painted longest-run first.
//
// The sort is the part specific to this drawing: once a run is floored to a
// pixel it is taller than the rows it covers, so a later rect overdraws its
// neighbour -- and in row order that silently costs the minority group (307
// village dogs erased 40% of the 63 wolves interleaved with them, which is
// exactly the group the stripe exists to find). Shortest last means the rarest
// mark survives. Painting order is all this changes; every rect keeps its true
// `y`.
function swatchRuns(
  sources: RowLabelSource[],
  columns: ReturnType<typeof annotationRuns>,
) {
  return [
    ...rowRuns(sources, source => source.rowColor).map(run => ({
      ...run,
      x: 0,
      width: ROW_SWATCH_WIDTH,
      testId: undefined,
    })),
    ...columns,
  ].sort((a, b) => b.end - b.start - (a.end - a.start))
}

export function SvgRowLabels({
  sources,
  rowHeight,
  labelOffset,
  scrollTop = 0,
  availableHeight,
  backdrop,
  text,
  annotations = [],
}: {
  sources: RowLabelSource[]
  rowHeight: number
  labelOffset: number
  scrollTop?: number
  availableHeight?: number
  backdrop?: 'paper' | 'wash'
  text?: ExportTextStyle
  annotations?: readonly RowAnnotationColumn[]
}) {
  const palette = usePalette()
  const fontSize = rowLabelFontSize(rowHeight, text)
  const separator = alpha(palette.text.primary, 0.12)
  const textFits = rowLabelsCarryText(rowHeight)
  const columns = annotationRuns(
    sources,
    annotations,
    rowColorWidth(sources, rowHeight, annotations),
  )
  // Without a color there is nothing left once the text is gone, so a track
  // whose rows carry no color draws nothing rather than a bare stripe of the
  // default background.
  const runs = textFits ? [] : swatchRuns(sources, columns)

  function offscreen(y: number, height: number) {
    return (
      availableHeight !== undefined && (y + height < 0 || y > availableHeight)
    )
  }

  const boxWidth = rowLabelsBoxWidth(sources, rowHeight, text, annotations)
  const textX = rowLabelTextX(sources, annotations)
  const rows = textFits
    ? sources
        .map((source, idx) => ({ source, idx, y: idx * rowHeight - scrollTop }))
        .filter(({ y }) => !offscreen(y, rowHeight))
    : []
  const boxes = rows
    .map(({ y }) => `M0 ${y}h${boxWidth}v${rowHeight}h${-boxWidth}z`)
    .join('')
  const separators = rows
    .filter(({ idx }) => backdrop && idx > 0)
    .map(({ y }) => `M0 ${y}h${boxWidth}v1h${-boxWidth}z`)
    .join('')

  return textFits ? (
    <g transform={`translate(${labelOffset} 0)`}>
      {backdrop ? (
        <>
          <path
            d={boxes}
            {...getFillProps(
              alpha(palette.background.paper, backdrop === 'paper' ? 1 : 0.9),
            )}
          />
          {backdrop === 'wash' ? (
            <path
              d={boxes}
              {...getFillProps(alpha(palette.text.primary, 0.04))}
            />
          ) : null}
        </>
      ) : null}
      {rows.map(({ source, y }) =>
        source.rowColor ? (
          <rect
            key={source.name}
            data-testid="row-color-bar"
            x={0}
            y={y}
            width={rowColorWidth(sources, rowHeight, annotations)}
            height={rowHeight}
            {...getFillProps(source.rowColor)}
          />
        ) : null,
      )}
      {columns.map(run => {
        const y = run.start * rowHeight - scrollTop
        const height = (run.end - run.start) * rowHeight
        return offscreen(y, height) ? null : (
          <rect
            key={`${run.x}:${sources[run.start]!.name}`}
            data-testid={run.testId}
            x={run.x}
            y={y}
            width={run.width}
            height={height}
            {...getFillProps(run.key)}
          />
        )
      })}
      {separators ? <path d={separators} {...getFillProps(separator)} /> : null}
      {rows.map(({ source, y }) => {
        const full = rowLabelFullText(source)
        const shown = rowLabelText(source, rowHeight, text)
        return (
          <text
            key={source.name}
            x={textX}
            y={y + rowHeight / 2}
            fontSize={fontSize}
            dominantBaseline="central"
            style={shown === full ? undefined : { pointerEvents: 'auto' }}
            {...getFillProps(palette.text.primary)}
          >
            {shown === full ? null : <title>{full}</title>}
            {shown}
          </text>
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
          // the run's first row names it: stable across a re-sort, unlike the
          // array index the sorted list would otherwise supply
          <rect
            key={`${run.x}:${sources[run.start]!.name}`}
            data-testid={run.testId}
            x={run.x}
            y={y}
            width={run.width}
            height={height}
            {...getFillProps(run.key)}
          />
        )
      })}
    </g>
  ) : null
}
