import { getColorBySwatch } from './colorLegend.ts'

import type { SyntenyColorBy } from './colorUtils.ts'

// Compact swatch shown next to each color-by menu item, so the ramps and
// structural color schemes are self-documenting at the point of selection.
// Continuous modes render a gradient bar with domain labels; default/strand
// render a row of their discrete colors (chip labels are shown in the fuller
// floating legend, not here).
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
      {swatch?.kind === 'ramp' ? (
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
      {swatch?.kind === 'chips' ? (
        <span style={{ display: 'inline-flex', gap: 2, marginLeft: 'auto' }}>
          {swatch.chips.map(chip => (
            <span
              key={chip.label}
              title={chip.label}
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                border: '1px solid rgba(128,128,128,0.5)',
                background: chip.color,
              }}
            />
          ))}
        </span>
      ) : null}
    </span>
  )
}
