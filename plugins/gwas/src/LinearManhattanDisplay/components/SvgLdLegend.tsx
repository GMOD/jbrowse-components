import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core'

import { LD_LEGEND, LD_LEGEND_SWATCH_PX, LD_LEGEND_TITLE } from '../ldBins.ts'

const ROW_H = 14

// SVG-export counterpart of the on-screen (HTML/MUI) LdColorLegend: the r² key
// shown top-right when points are colored by LD to the index SNP. Pure SVG so
// it serializes into the export; shares only the bin data with the live legend.
export default function SvgLdLegend({ width }: { width: number }) {
  return (
    <g transform={`translate(${width - 84},${YSCALEBAR_LABEL_OFFSET + 4})`}>
      <rect
        x={-4}
        y={-4}
        width={88}
        height={ROW_H + LD_LEGEND.length * ROW_H + 4}
        fill="rgba(255,255,255,0.85)"
        stroke="#ccc"
        strokeWidth={0.5}
        rx={2}
      />
      <text fontSize={10} fontWeight="bold" y={ROW_H - 4}>
        {LD_LEGEND_TITLE}
      </text>
      {LD_LEGEND.map(({ label, color }, i) => (
        <g key={label} transform={`translate(0,${ROW_H + i * ROW_H})`}>
          <rect
            width={LD_LEGEND_SWATCH_PX}
            height={LD_LEGEND_SWATCH_PX}
            fill={color}
            stroke="rgba(0,0,0,0.2)"
            strokeWidth={0.5}
          />
          <text fontSize={10} x={LD_LEGEND_SWATCH_PX + 4} y={LD_LEGEND_SWATCH_PX - 1}>
            {label}
          </text>
        </g>
      ))}
    </g>
  )
}
