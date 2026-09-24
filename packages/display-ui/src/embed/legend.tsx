import { LegendSwatchGlyph } from '@jbrowse/core/ui/LegendSwatchGlyph'
import {
  legendSwatches,
  nonEmptyLegendSections,
} from '@jbrowse/core/ui/legendSpec'
import { observer } from 'mobx-react'

import type { LegendItem, LegendSpec } from '@jbrowse/core/ui/legendSpec'
import type React from 'react'

const SWATCH = 12

function gradientCss({ stops }: NonNullable<LegendItem['gradient']>) {
  return `linear-gradient(to right, ${stops
    .map(
      ({ color, opacity = 1, offset }) =>
        `color-mix(in srgb, ${color} ${Math.round(opacity * 100)}%, transparent) ${offset * 100}%`,
    )
    .join(', ')})`
}

function Row({ item }: { item: LegendItem }) {
  const { gradient, label, hidden } = item
  return gradient ? (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {label}
      <span>{gradient.minLabel}</span>
      <span
        style={{
          width: 80,
          height: SWATCH,
          backgroundImage: gradientCss(gradient),
        }}
      />
      <span>{gradient.maxLabel}</span>
    </span>
  ) : (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        opacity: hidden ? 0.5 : undefined,
        textDecoration: hidden ? 'line-through' : undefined,
      }}
    >
      {legendSwatches(item).map(swatch => (
        <svg key={swatch.color} aria-hidden width={SWATCH} height={SWATCH}>
          <LegendSwatchGlyph swatch={swatch} size={SWATCH} />
        </svg>
      ))}
      {label}
    </span>
  )
}

function legendSpecIn(display: unknown) {
  return display && typeof display === 'object' && 'legendSpec' in display
    ? (display.legendSpec as LegendSpec)
    : undefined
}

export const Legend = observer(function Legend({
  view,
  trackId,
  style,
}: {
  view: {
    getTrack: (trackId: string) => { activeDisplay: unknown } | undefined
  }
  trackId: string
  style?: React.CSSProperties
}) {
  const legendSpec = legendSpecIn(view.getTrack(trackId)?.activeDisplay)
  const sections = nonEmptyLegendSections(legendSpec?.sections ?? [])
  return legendSpec && sections.length ? (
    <div
      data-testid="embed-legend"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '2px 12px',
        fontSize: '0.75rem',
        ...style,
      }}
    >
      {legendSpec.title ? <strong>{legendSpec.title}</strong> : null}
      {sections.map(section => (
        <span key={section.id} style={{ display: 'contents' }}>
          {sections.length > 1 && section.title ? (
            <strong>{section.title}</strong>
          ) : null}
          {section.note ? (
            <span style={{ opacity: 0.7 }}>{section.note}</span>
          ) : null}
          {section.items.map((item, i) => (
            // eslint-disable-next-line @eslint-react/no-array-index-key -- a key's rows have no id, and a note row has no value
            <Row key={i} item={item} />
          ))}
        </span>
      ))}
    </div>
  ) : null
})
