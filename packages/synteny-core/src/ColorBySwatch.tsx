import { getColorBySwatch } from './colorLegend.ts'

import type { SyntenyColorBy } from './colorUtils.ts'

// Compact swatch shown next to each color-by menu item, so viridis/cividis
// ramps are self-documenting at the point of selection.
export function ColorBySwatch({ colorBy }: { colorBy: SyntenyColorBy }) {
  const swatch = getColorBySwatch(colorBy)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        width: 78,
        flexShrink: 0,
        fontSize: '0.6rem',
        lineHeight: 1,
        opacity: 0.75,
      }}
    >
      {swatch ? (
        <>
          <span style={{ minWidth: 22, textAlign: 'right' }}>
            {swatch.minLabel}
          </span>
          <span
            style={{
              flex: 1,
              height: 10,
              borderRadius: 2,
              border: '1px solid rgba(128,128,128,0.5)',
              background: swatch.background,
            }}
          />
          <span style={{ minWidth: 22 }}>{swatch.maxLabel}</span>
        </>
      ) : null}
    </span>
  )
}
