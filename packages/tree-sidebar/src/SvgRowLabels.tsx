import { getFillProps, measureText } from '@jbrowse/core/util'
import { alpha, useTheme } from '@mui/material'

export function SvgRowLabels({
  sources,
  rowHeight,
  labelOffset,
  scrollTop = 0,
  availableHeight,
}: {
  sources: { name: string; label?: string; labelColor?: string }[]
  rowHeight: number
  labelOffset: number
  scrollTop?: number
  availableHeight?: number
}) {
  const theme = useTheme()
  if (rowHeight < 6) {
    return null
  }
  const fontSize = Math.min(rowHeight, 12)
  const boxHeight = Math.min(rowHeight, 20)

  // `name` is the identity (key + hit-test); `label` is the displayed string if
  // the adapter config supplied one.
  let boxWidth = 10
  for (const source of sources) {
    const w = measureText(source.label ?? source.name, fontSize) + 10
    boxWidth = Math.max(boxWidth, w)
  }

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
          </g>
        )
      })}
    </g>
  )
}
