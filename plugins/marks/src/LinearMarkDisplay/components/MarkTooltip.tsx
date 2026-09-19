import HoverTooltip from '@jbrowse/core/ui/HoverTooltip'
import { LegendSwatchGlyph } from '@jbrowse/core/ui/LegendSwatchGlyph'
import { assembleLocString } from '@jbrowse/core/util'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import { GLYPH_CODES, GLYPH_NAMES } from '@jbrowse/core/util/glyphNames'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import { toP } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import {
  categoryLabel,
  colorSection,
  glyphLabel,
  glyphSection,
} from '../legend.ts'

import type { MarkShapeName } from '../configSchema.ts'
import type { FacetLayout } from '../facet.ts'
import type { MarkHitInfo } from '../findMarkHit.ts'
import type { MarkLegendSection } from '../legend.ts'
import type { MouseState } from '@jbrowse/core/ui'
import type { LegendSwatch } from '@jbrowse/core/ui/legendSpec'
import type { MarkEncoding } from '@jbrowse/core/util/markEncoding'

export interface MarkTooltipModel {
  hoveredFeature: MarkHitInfo | undefined
  encodings: MarkEncoding[]
  markShapes: MarkShapeName[]
  legendSections: MarkLegendSection[]
  facetLayout: FacetLayout
}

/** One channel of the hovered mark: what it was read from, and what it says. */
interface ChannelRow {
  channel: string
  field?: string
  value?: string | number
  swatch?: LegendSwatch
}

const SWATCH_PX = 10

// A `jexl:` channel names itself rather than printing its expression, which is
// a line of code where every other channel is a field name.
function channelName(ref: string) {
  return isJexl(ref) ? 'jexl' : ref
}

function glyphNameOf(code: number | undefined) {
  return GLYPH_NAMES.find(name => GLYPH_CODES[name] === code)
}

function colorRow(
  hit: MarkHitInfo,
  encoding: MarkEncoding | undefined,
  sections: MarkLegendSection[],
): ChannelRow | undefined {
  const { color, colorValue } = hit
  const swatch =
    color === undefined ? undefined : { color: abgrToCssRgba(color) }
  const scale = colorSection(sections, hit.markIndex)
  if (scale) {
    return {
      channel: 'color',
      field: scale.field,
      value:
        colorValue !== undefined
          ? toP(colorValue, 4)
          : color === undefined
            ? undefined
            : categoryLabel(scale, color),
      swatch,
    }
  }
  if (!swatch) {
    return undefined
  }
  const declared = encoding?.color
  return {
    channel: 'color',
    field:
      typeof declared === 'string' && isJexl(declared) ? 'jexl' : undefined,
    swatch,
  }
}

function glyphRow(
  hit: MarkHitInfo,
  encoding: MarkEncoding | undefined,
  sections: MarkLegendSection[],
): ChannelRow | undefined {
  const name = glyphNameOf(hit.glyph)
  if (!name) {
    return undefined
  }
  const swatch: LegendSwatch = { color: 'currentColor', glyph: name }
  const scale = glyphSection(sections, hit.markIndex)
  if (scale) {
    return {
      channel: 'glyph',
      field: scale.kind === 'glyph' ? scale.field : undefined,
      value: glyphLabel(scale, name),
      swatch,
    }
  }
  const declared = encoding?.glyph
  return typeof declared === 'string' && isJexl(declared)
    ? { channel: 'glyph', field: 'jexl', value: name, swatch }
    : undefined
}

function rowRow(
  hit: MarkHitInfo,
  encoding: MarkEncoding | undefined,
  facetLayout: FacetLayout,
): ChannelRow | undefined {
  const { row } = hit
  if (row === undefined || encoding?.row === undefined) {
    return undefined
  }
  const section = facetLayout.sections.find(
    s => row >= s.firstRow && row < s.firstRow + s.rowCount,
  )
  return section
    ? { channel: 'row', value: section.label }
    : { channel: 'row', field: channelName(encoding.row), value: String(row) }
}

/**
 * Every channel the hovered mark encodes, each off the hovered instance: the
 * value channel, then colour, glyph and the band, so a reader sees the fields
 * the plot was drawn from rather than the two it happens to print.
 */
function markTooltipRows(
  hit: MarkHitInfo,
  encoding: MarkEncoding | undefined,
  sections: MarkLegendSection[],
  facetLayout: FacetLayout,
): ChannelRow[] {
  const { y } = hit
  return [
    y !== undefined && encoding?.y
      ? { channel: 'y', field: channelName(encoding.y), value: toP(y, 4) }
      : undefined,
    colorRow(hit, encoding, sections),
    glyphRow(hit, encoding, sections),
    rowRow(hit, encoding, facetLayout),
  ].filter(row => row !== undefined)
}

const MarkTooltip = observer(function MarkTooltip({
  model,
  mouseState,
}: {
  model: MarkTooltipModel
  mouseState: MouseState | undefined
}) {
  const { hoveredFeature: hit, encodings, markShapes, legendSections } = model
  return (
    <HoverTooltip hit={hit} mouseState={mouseState}>
      {hit ? (
        <div>
          <div>{assembleLocString(hit)}</div>
          {markTooltipRows(
            hit,
            encodings[hit.markIndex],
            legendSections,
            model.facetLayout,
          ).map(({ channel, field, value, swatch }) => (
            <div key={channel}>
              {swatch ? (
                <svg
                  width={SWATCH_PX}
                  height={SWATCH_PX}
                  style={{ marginRight: 4, verticalAlign: 'middle' }}
                >
                  <LegendSwatchGlyph swatch={swatch} size={SWATCH_PX} />
                </svg>
              ) : null}
              {field}
              {field !== undefined && value !== undefined ? ': ' : null}
              {value}
            </div>
          ))}
          <small>{markShapes[hit.markIndex]}</small>
        </div>
      ) : null}
    </HoverTooltip>
  )
})

export default MarkTooltip
