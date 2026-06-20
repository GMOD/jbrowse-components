import { getFillProps, measureText } from '@jbrowse/core/util'
import { alpha, useTheme } from '@mui/material'

export function SvgRowLabels({
  sources,
  rowHeight,
  labelOffset,
  scrollTop = 0,
  availableHeight,
  details,
}: {
  sources: { name: string; label?: string; labelColor?: string }[]
  rowHeight: number
  labelOffset: number
  scrollTop?: number
  availableHeight?: number
  // Optional per-row secondary text (aligned to `sources` by index), rendered
  // muted + right-aligned in the label box — e.g. a per-row percent identity.
  details?: (string | undefined)[]
}) {
  const theme = useTheme()
  if (rowHeight < 6) {
    return null
  }
  const fontSize = Math.min(rowHeight, 12)
  const boxHeight = Math.min(rowHeight, 20)

  // `name` is the identity (key + hit-test); `label` is the displayed string if
  // the adapter config supplied one.
  let labelWidth = 10
  for (const source of sources) {
    const w = measureText(source.label ?? source.name, fontSize) + 10
    labelWidth = Math.max(labelWidth, w)
  }
  // Reserve room for the widest detail string so name + detail never overlap.
  let detailWidth = 0
  for (const d of details ?? []) {
    if (d) {
      detailWidth = Math.max(detailWidth, measureText(d, fontSize))
    }
  }
  const boxWidth = labelWidth + (detailWidth ? detailWidth + 8 : 0)

  const defaultBackground = alpha(theme.palette.background.paper, 0.8)
  return (
    <g transform={`translate(${labelOffset} 0)`}>
      {sources.map((source, idx) => {
        const y = idx * rowHeight - scrollTop
        if (
          availableHeight !== undefined &&
          (y + rowHeight < 0 || y > availableHeight)
        ) {
          return null
        }
        const lc = source.labelColor
        const fg = lc
          ? theme.palette.getContrastText(lc)
          : theme.palette.text.primary
        const detail = details?.[idx]
        return (
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
            {detail ? (
              <text
                x={boxWidth - 4}
                y={y + boxHeight / 2}
                fontSize={fontSize}
                textAnchor="end"
                dominantBaseline="central"
                fillOpacity={0.65}
                {...getFillProps(fg)}
              >
                {detail}
              </text>
            ) : null}
          </g>
        )
      })}
    </g>
  )
}
