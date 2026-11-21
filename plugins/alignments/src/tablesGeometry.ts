import {
  LONG_INSERTION_MIN_LENGTH,
  MIN_HEIGHT_FOR_TEXT,
  MIN_QUALITY_LETTER_OPACITY,
  insertionBarWidth,
  insertionSizeAlpha,
  labelFadeOpacity,
  labelFont,
} from '@jbrowse/alignments-core'
import {
  readConfObject,
  refusingUndeclaredKeys,
} from '@jbrowse/core/configuration'
import { connectorPlacement } from '@jbrowse/render-core/marks/connectorPlacement'
import {
  CONNECTOR_ARROW,
  CONNECTOR_BOW,
  CONNECTOR_LEADING_2,
  CONNECTOR_MINUS_1,
  CONNECTOR_MINUS_2,
  CONNECTOR_STRAIGHT,
} from '@jbrowse/render-core/shaders/connectorMarkConsts'

import { pileupConfigSchema } from './LinearAlignmentsDisplay/pileupConfigSchema.ts'
import { pileupMismatchesOpacityConfigSchema } from './LinearAlignmentsDisplay/pileupMismatchesOpacityConfigSchema.ts'
import { connectorArrowPx } from './features/linkedReads/connectorFeed.ts'
import {
  qualityOpacityOf,
  resolvedMismatchOpacity,
} from './features/mismatch/qualityOpacity.ts'
import {
  frequencyFadeGate,
  sizeAlpha,
} from './shaders/slang/alignmentsUniforms.js.generated.ts'
import { QUAL_UNAVAILABLE } from './shaders/slang/mismatch.consts.generated.ts'
import { qualityFade } from './shaders/slang/mismatch.js.generated.ts'

import type { PileupMismatchesOpacitySnapshot } from './LinearAlignmentsDisplay/pileupMismatchesOpacityConfigSchema.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

type MarkColumn = number | readonly number[]

/**
 * The columns `names` of one mark kind's table as arrays of one length, a
 * scalar read as one mark, as R's jsonlite unboxes a one-row table. A table
 * left out is no marks; a column left out takes `defaults`' value, or is
 * refused.
 */
function markColumns<N extends string>(
  kind: string,
  table: Partial<Record<N, MarkColumn | null>> | null | undefined,
  names: readonly N[],
  defaults: Partial<Record<N, number>> = {},
) {
  const given: Partial<Record<N, MarkColumn | null>> = table ?? {}
  const none = table === undefined || table === null
  const arrays = names.map(name => {
    const column: MarkColumn | null | undefined = given[name]
    if (column === undefined || column === null) {
      return undefined
    }
    if (typeof column === 'number') {
      return [column]
    }
    if (!Array.isArray(column)) {
      throw new Error(`${kind}.${name} is a number or an array of numbers`)
    }
    return column as readonly number[]
  })
  const rows = none ? 0 : Math.max(0, ...arrays.map(a => a?.length ?? 0))
  return Object.fromEntries(
    names.map((name, i) => {
      const column = arrays[i]
      if (column === undefined) {
        const fallback = defaults[name]
        if (fallback === undefined && !none) {
          throw new Error(`${kind}.${name} is missing`)
        }
        return [name, Array.from({ length: rows }, () => fallback!)]
      }
      if (column.length !== rows) {
        const longest = names[arrays.findIndex(a => a?.length === rows)]!
        throw new Error(
          `${kind}.${name} has ${column.length} rows where ${kind}.${longest} has ${rows}`,
        )
      }
      return [name, column]
    }),
  ) as Record<N, readonly number[]>
}

/**
 * #api
 * Each connector of a `connectors` table as the pileup places its cubic at
 * `pxPerBp`, through the connector mark's own placement, for a host drawing
 * the table at its figure's scale. Both ends lie in one region, `reversed`
 * where it is flipped; `featureHeight` and `featureSpacing` are `readPitch`'s.
 * Returns each curve's two control points, `handle` and `endHandle` in bp
 * with `handleRow` and `endHandleRow` in rows as `row` counts them, a
 * straight connector's at its ends; and, where an arrowhead fits at this
 * scale, `arrow` true and `arrowBack`, the bp its arms reach back to, which
 * stand `arrowRows` rows off the row.
 */
export function alignmentConnectorCurves({
  pxPerBp,
  reversed = false,
  featureHeight,
  featureSpacing,
  connectors,
}: {
  pxPerBp: number
  reversed?: boolean
  featureHeight: number
  featureSpacing: number
  connectors: {
    start: readonly number[]
    end: readonly number[]
    row: readonly number[]
    endRow: readonly number[]
    kind: readonly ('straight' | 'curve' | 'bow' | 'loop')[]
    dip: readonly number[]
    strand: readonly number[]
    endStrand: readonly number[]
    leading: readonly boolean[]
    arrow: readonly boolean[]
  }
}) {
  if (!Number.isFinite(pxPerBp) || pxPerBp <= 0) {
    throw new Error(`pxPerBp is ${pxPerBp}; it takes a finite number > 0`)
  }
  const { start, end, row, endRow, kind, dip, strand, endStrand } = connectors
  const count = start.length
  const signedPxPerBp = reversed ? -pxPerBp : pxPerBp
  const rowPitchPx = featureHeight + featureSpacing
  const arrowPx = connectorArrowPx(featureHeight)
  const channels = {
    x: Uint32Array.from(start),
    x2: Uint32Array.from(end),
    x2Region: new Uint32Array(count),
    row: Uint32Array.from(row),
    row2: Uint32Array.from(endRow),
    bend: Float32Array.from(kind, (k, i) =>
      k === 'bow' ? CONNECTOR_BOW : dip[i]!,
    ),
    width: new Float32Array(count).fill(1),
    color: new Uint32Array(count),
    bits: Uint8Array.from(
      kind,
      (k, i) =>
        (strand[i]! < 0 ? CONNECTOR_MINUS_1 : 0) |
        (endStrand[i]! < 0 ? CONNECTOR_MINUS_2 : 0) |
        (connectors.leading[i] ? CONNECTOR_LEADING_2 : 0) |
        (k === 'straight' ? CONNECTOR_STRAIGHT : 0) |
        (connectors.arrow[i] ? CONNECTOR_ARROW : 0),
    ),
    count,
  }
  const params = {
    regions: [{ anchorPx: 0, anchorBp: 0, signedPxPerBp }],
    rowOffsetPx: 0,
    rowPitchPx,
    arrowPx,
  }
  const placed = Array.from({ length: count }, (_, i) =>
    connectorPlacement(channels, params, 0, i),
  )
  const bp = (px: number) => px / signedPxPerBp
  const rows = (px: number) => px / rowPitchPx
  return {
    handle: placed.map(p => bp(p!.x1)),
    handleRow: placed.map(p => rows(p!.y1)),
    endHandle: placed.map(p => bp(p!.x2)),
    endHandleRow: placed.map(p => rows(p!.y2)),
    arrow: placed.map(p => p!.arrow),
    arrowBack: placed.map(p => bp(p!.x3 + p!.back)),
    arrowRows: rows(arrowPx),
  }
}

let pileupDefaults: Instance<typeof pileupConfigSchema> | undefined

/**
 * #api
 * Each insertion's width in px and each insertion's, deletion's, mismatch's
 * and clip's alpha as the pileup draws them at `pxPerBp`, through the
 * shaders' generated twins, for a host that draws the marks at its figure's
 * scale. `fade` is a mark's `fade` column, `length` its length in bp (a
 * deletion's `end - start`) and `quality` a mismatch's, 255 where the read
 * has none. A column may be a number, for one mark. `featureHeight` is
 * `readPitch.featureHeight`, `fadeLowFrequency` the display's
 * `pileup.fadeLowFrequency`, and `mismatchOpacity` its
 * `pileup.mismatches.encoding.opacity` as a config writes it; each of the
 * three takes the pileup config's default when left out.
 *
 * - An insertion's `widthPx` is `insertionBarWidthPx`, and its `alpha`
 *   `insertionSizeAlpha` times, under `LONG_INSERTION_MIN_LENGTH`,
 *   `frequencyFadeGate` over `pxPerBp` squared.
 * - A deletion's `alpha` is `sizeAlpha` of its width in px times
 *   `frequencyFadeGate` over that width squared. Its `labelAlpha`, its
 *   length label's, is `labelFadeOpacity` of `visibleLength`, the bp of it
 *   inside its region (`length` when left out), in px against the width its
 *   digits need, and 0 on a read under `MIN_HEIGHT_FOR_TEXT`.
 * - A mismatch's `alpha` is `qualityFade` times `frequencyFadeGate` over
 *   `pxPerBp`, and a clip's that gate alone. `quality` may be left out
 *   while `mismatchOpacity` is a constant. Its `letterAlpha`, its base
 *   letter's, is `qualityFade` alone, 0 under
 *   `MIN_QUALITY_LETTER_OPACITY`, where the display writes no letter.
 */
export function alignmentMarkAlpha({
  pxPerBp,
  featureHeight,
  fadeLowFrequency,
  mismatchOpacity = {},
  insertions,
  deletions,
  mismatches,
  clips,
}: {
  pxPerBp: number
  featureHeight?: number
  fadeLowFrequency?: boolean
  mismatchOpacity?: PileupMismatchesOpacitySnapshot
  insertions?: { length: MarkColumn; fade: MarkColumn }
  deletions?: {
    length: MarkColumn
    fade: MarkColumn
    visibleLength?: MarkColumn | null
  }
  mismatches?: { fade: MarkColumn; quality?: MarkColumn }
  clips?: { fade: MarkColumn }
}) {
  if (!Number.isFinite(pxPerBp) || pxPerBp < 0) {
    throw new Error(`pxPerBp is ${pxPerBp}; it takes a finite number >= 0`)
  }
  pileupDefaults ??= pileupConfigSchema.create()
  const height: number =
    featureHeight ?? readConfObject(pileupDefaults, ['mark', 'height'])
  if (!Number.isFinite(height) || height < 0) {
    throw new Error(
      `featureHeight is ${featureHeight}; it takes a finite number >= 0`,
    )
  }
  const byFrequency: boolean =
    fadeLowFrequency ?? readConfObject(pileupDefaults, 'fadeLowFrequency')
  const opacity = refusingUndeclaredKeys(() =>
    pileupMismatchesOpacityConfigSchema.create(
      typeof mismatchOpacity === 'string'
        ? { field: mismatchOpacity }
        : typeof mismatchOpacity === 'number'
          ? { value: mismatchOpacity }
          : mismatchOpacity,
    ),
  )
  const setting = resolvedMismatchOpacity({
    value: readConfObject(opacity, 'value'),
    field: readConfObject(opacity, 'field'),
    scale: {
      domainMin: readConfObject(opacity, ['scale', 'domainMin']),
      domainMax: readConfObject(opacity, ['scale', 'domainMax']),
      range: readConfObject(opacity, ['scale', 'range']),
    },
  })
  const byQuality = setting.field === 'baseQuality'
  const { zero, slope, min, max } = qualityOpacityOf(setting)
  const ins = markColumns('insertions', insertions, ['length', 'fade'])
  const del = markColumns(
    'deletions',
    deletions && {
      ...deletions,
      visibleLength: deletions.visibleLength ?? deletions.length,
    },
    ['length', 'fade', 'visibleLength'],
  )
  const mis = markColumns(
    'mismatches',
    mismatches,
    ['fade', 'quality'],
    byQuality ? {} : { quality: QUAL_UNAVAILABLE },
  )
  const clip = markColumns('clips', clips, ['fade'])
  const gate = (base: number, fade: number) =>
    frequencyFadeGate(base, fade, byFrequency)
  const font = labelFont(height)
  const qualityFades = mis.quality.map(quality =>
    qualityFade(quality, zero, slope, min, max),
  )
  return {
    insertions: {
      widthPx: ins.length.map(length =>
        insertionBarWidth(length, pxPerBp, height),
      ),
      alpha: ins.length.map(
        (length, i) =>
          insertionSizeAlpha(length, pxPerBp) *
          (length < LONG_INSERTION_MIN_LENGTH
            ? gate(pxPerBp * pxPerBp, ins.fade[i]!)
            : 1),
      ),
    },
    deletions: {
      alpha: del.length.map((length, i) => {
        const widthPx = length * pxPerBp
        return sizeAlpha(widthPx) * gate(widthPx * widthPx, del.fade[i]!)
      }),
      labelAlpha: del.length.map((length, i) =>
        height >= MIN_HEIGHT_FOR_TEXT
          ? labelFadeOpacity(
              del.visibleLength[i]! * pxPerBp,
              font.measure(String(length)),
            )
          : 0,
      ),
    },
    mismatches: {
      alpha: mis.fade.map((fade, i) => qualityFades[i]! * gate(pxPerBp, fade)),
      letterAlpha: qualityFades.map(q =>
        q >= MIN_QUALITY_LETTER_OPACITY ? q : 0,
      ),
    },
    clips: {
      alpha: clip.fade.map(fade => gate(pxPerBp, fade)),
    },
  }
}
