import HoverTooltip from '@jbrowse/core/ui/HoverTooltip'
import { LegendSwatchGlyph } from '@jbrowse/core/ui/LegendSwatchGlyph'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import { SHAPE_CODES, SHAPE_NAMES } from '@jbrowse/core/util/shapeNames'
import { thresholdKeyEntries } from '@jbrowse/core/util/thresholdScale'
import { keySlot, thresholdBandOf } from '@jbrowse/render-core/marks'
import { toP } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import { hitLocString } from '../findMarkHit.ts'
import {
  categoryLabel,
  colorSection,
  shapeLabel,
  shapeSection,
} from '../legend.ts'

import type { MarkType } from '../configSchema.ts'
import type { FacetLayout } from '../facet.ts'
import type { MarkHitInfo } from '../findMarkHit.ts'
import type { MarkLegendSection } from '../legend.ts'
import type { MouseState } from '@jbrowse/core/ui'
import type { LegendSwatch } from '@jbrowse/core/ui/legendSpec'
import type { MarkEncoding } from '@jbrowse/core/util/markEncoding'
import type { RowTable } from '@jbrowse/render-core/marks'

export interface MarkTooltipModel {
  hoveredFeature: MarkHitInfo | undefined
  encodings: MarkEncoding[]
  markTypes: MarkType[]
  legendSections: MarkLegendSection[]
  facetLayout: FacetLayout
  sources: readonly { label?: string }[]
  rowTable: RowTable | undefined
  coarseTierStandsIn: boolean
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

function shapeNameOf(code: number | undefined) {
  return SHAPE_NAMES.find(name => SHAPE_CODES[name] === code)
}

function colorRow(
  hit: MarkHitInfo,
  encoding: MarkEncoding | undefined,
  sections: MarkLegendSection[],
): ChannelRow | undefined {
  const { color, colorValue } = hit
  if (hit.heldColor) {
    return undefined
  }
  const swatch =
    color === undefined ? undefined : { color: abgrToCssRgba(color) }
  const section = colorSection(sections, hit.markIndex)
  if (section?.scale.kind === 'threshold' && colorValue !== undefined) {
    // the interval the value falls in, as the key names and colors it
    const { scale } = section
    const rows = thresholdKeyEntries(scale.domain, scale.range, scale)
    const row = Number.isNaN(colorValue)
      ? undefined
      : rows[thresholdBandOf(colorValue, scale.domain)]
    return {
      channel: 'color',
      field: scale.field,
      value: `${toP(colorValue, 4)}${row ? ` (${row.label})` : ''}`,
      swatch: row ? { color: row.color } : swatch,
    }
  }
  if (section) {
    return {
      channel: 'color',
      field: section.scale.field,
      value:
        colorValue !== undefined
          ? toP(colorValue, 4)
          : color === undefined
            ? undefined
            : categoryLabel(section, color),
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

function shapeRow(
  hit: MarkHitInfo,
  encoding: MarkEncoding | undefined,
  sections: MarkLegendSection[],
): ChannelRow | undefined {
  const name = shapeNameOf(hit.glyph)
  if (!name) {
    return undefined
  }
  const swatch: LegendSwatch = { color: 'currentColor', shape: name }
  const section = shapeSection(sections, hit.markIndex)
  if (section) {
    return {
      channel: 'shape',
      field: section.scale.field,
      value: shapeLabel(section, name),
      swatch,
    }
  }
  const declared = encoding?.shape
  return typeof declared === 'string' && isJexl(declared)
    ? { channel: 'shape', field: 'jexl', value: name, swatch }
    : undefined
}

function rowRow(
  hit: MarkHitInfo,
  encoding: MarkEncoding | undefined,
  facetLayout: FacetLayout,
  sources: readonly { label?: string }[],
  rowTable: RowTable | undefined,
): ChannelRow | undefined {
  const band = hit.row === undefined ? undefined : keySlot(hit.row, rowTable)
  if (band === undefined) {
    return undefined
  }
  const section = facetLayout.sections.find(
    s => band >= s.firstRow && band < s.firstRow + s.rowCount,
  )
  if (section) {
    return {
      channel: 'row',
      value:
        (facetLayout.rows ? sources[band]?.label : undefined) ?? section.label,
    }
  }
  return encoding?.row === undefined
    ? undefined
    : { channel: 'row', field: channelName(encoding.row), value: String(band) }
}

/**
 * Every channel the hovered mark encodes, each off the hovered instance: the
 * value channel, then color, shape and the band, so a reader sees the fields
 * the plot was drawn from rather than the two it happens to print. A bin of
 * the density sidecar standing in is the sidecar's level, whatever field the
 * mark names.
 */
function markTooltipRows(
  hit: MarkHitInfo,
  encoding: MarkEncoding | undefined,
  sections: MarkLegendSection[],
  facetLayout: FacetLayout,
  sources: readonly { label?: string }[],
  rowTable: RowTable | undefined,
  sidecar: boolean,
): ChannelRow[] {
  const { y } = hit
  return [
    y !== undefined && encoding?.y
      ? {
          channel: 'y',
          field: sidecar ? 'density sidecar' : channelName(encoding.y),
          value: toP(y, 4),
        }
      : undefined,
    colorRow(hit, encoding, sections),
    shapeRow(hit, encoding, sections),
    rowRow(hit, encoding, facetLayout, sources, rowTable),
  ].filter(row => row !== undefined)
}

const MarkTooltip = observer(function MarkTooltip({
  model,
  mouseState,
}: {
  model: MarkTooltipModel
  mouseState: MouseState | undefined
}) {
  const { hoveredFeature: hit, encodings, markTypes, legendSections } = model
  return (
    <HoverTooltip hit={hit} mouseState={mouseState}>
      {hit ? (
        <div>
          <div>{hitLocString(hit)}</div>
          {markTooltipRows(
            hit,
            encodings[hit.markIndex],
            legendSections,
            model.facetLayout,
            model.sources,
            model.rowTable,
            model.coarseTierStandsIn,
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
          <small>{markTypes[hit.markIndex]}</small>
        </div>
      ) : null}
    </HoverTooltip>
  )
})

export default MarkTooltip
