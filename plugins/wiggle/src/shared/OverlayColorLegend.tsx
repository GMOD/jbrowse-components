import { measureLegendText } from './measureLegendText.ts'

interface LegendSource {
  name: string
  label?: string
  color?: string
  group?: string
}

interface LegendEntry {
  key: string
  label: string
  color?: string
}

// When sources have groups and every source within a group shares the same
// color, collapse to one legend entry per group (showing the group name) so
// a 50-source track with 2 groups shows 2 legend rows, not 50.
// Falls back to per-source entries for ungrouped sources or groups with
// inconsistent colors (e.g. the user explicitly overrode one sample).
function buildLegendEntries(sources: LegendSource[]): LegendEntry[] {
  if (!sources.some(s => s.group !== undefined)) {
    return sources.map(s => ({
      key: s.name,
      label: s.label ?? s.name,
      color: s.color,
    }))
  }

  const groupColor = new Map<string, string | undefined>()
  const groupConsistent = new Map<string, boolean>()

  for (const s of sources) {
    if (s.group === undefined) {
      continue
    }
    if (!groupColor.has(s.group)) {
      groupColor.set(s.group, s.color)
      groupConsistent.set(s.group, true)
    } else if (groupColor.get(s.group) !== s.color) {
      groupConsistent.set(s.group, false)
    }
  }

  const seen = new Set<string>()
  const entries: LegendEntry[] = []
  for (const s of sources) {
    if (s.group !== undefined && groupConsistent.get(s.group)) {
      if (!seen.has(s.group)) {
        seen.add(s.group)
        entries.push({
          key: `group:${s.group}`,
          label: s.group,
          color: groupColor.get(s.group),
        })
      }
    } else {
      entries.push({
        key: s.name,
        label: s.label ?? s.name,
        color: s.color,
      })
    }
  }
  return entries
}

export default function OverlayColorLegend({
  sources,
  fallbackColor,
  canvasWidth,
}: {
  sources: LegendSource[]
  fallbackColor: string
  canvasWidth: number
}) {
  const entries = buildLegendEntries(sources)
  let maxLabelWidth = 0
  for (const e of entries) {
    const w = measureLegendText(e.label, 10)
    if (w > maxLabelWidth) {
      maxLabelWidth = w
    }
  }
  const textLeft = 16
  const totalWidth = textLeft + maxLabelWidth + 6
  const x = Math.max(0, canvasWidth - totalWidth - 4)
  return (
    <g transform={`translate(${x} 0)`}>
      {entries.map((entry, idx) => {
        const y = idx * 14
        return (
          <g key={entry.key}>
            <rect
              x={0}
              y={y}
              width={totalWidth}
              height={14}
              fill="rgba(255,255,255,0.8)"
            />
            <rect
              x={2}
              y={y + 2}
              width={10}
              height={10}
              fill={entry.color ?? fallbackColor}
            />
            <text x={textLeft} y={y + 11} fontSize={10} fill="black">
              {entry.label}
            </text>
          </g>
        )
      })}
    </g>
  )
}
