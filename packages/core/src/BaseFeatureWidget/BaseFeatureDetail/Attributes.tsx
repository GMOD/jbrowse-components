import { Suspense, lazy } from 'react'

import {
  isLocalPathLocation,
  isObject,
  isUriLocation,
  measureText,
} from '../../util/index.ts'
import ArrayValue, { isObjectArray } from './ArrayValue.tsx'
import SimpleField from './SimpleField.tsx'
import UriField from './UriField.tsx'
import { accessNested } from './util.ts'

import type { Descriptors, FeatureFormatter, FieldActions } from '../types.tsx'

// Lazy: reaches @mui/x-data-grid, and this module sits on the eager startup
// path via product-core's ui barrel (AboutDialog -> AboutDialogContents).
// Only a homogeneous object array actually renders a grid.
const DataGridDetails = lazy(() => import('./DataGridDetails.tsx'))

const MAX_FIELD_NAME_WIDTH = 170

// must match FieldName's own font size and horizontal padding, or the measured
// column is not the width the label needs
const FIELD_NAME_FONT_SIZE = 12
const FIELD_NAME_PADDING = 10

// Max extra unique columns vs. first row before falling back to per-row field
// sections instead of the data grid (avoids a mostly-empty, hard-to-read grid)
const DATAGRID_SCHEMA_TOLERANCE = 5

function isHomogeneousObjectArray(
  arr: unknown[],
): arr is Record<string, unknown>[] {
  if (arr.length <= 1 || !arr.every(isObject)) {
    return false
  }
  const firstKeyCount = Object.keys(arr[0]!).length
  const unionKeyCount = new Set(arr.flatMap(Object.keys)).size
  return unionKeyCount < firstKeyCount + DATAGRID_SCHEMA_TOLERANCE
}

// these are always omitted as too detailed
const globalOmit = [
  'length',
  'position',
  'subfeatures',
  'uniqueId',
  'exonFrames',
  '_exonFrames',
  'parentId',
  'thickStart',
  'thickEnd',
  // BED12/bigGenePred parsing internals (block/CDS-shape bookkeeping, not
  // meaningful feature attributes)
  'chromStarts',
  'blockStarts',
  'blockSizes',
  'blockCount',
  'reserved',
  'cdsStartStat',
  'cdsEndStat',
]

function isLocation(value: unknown) {
  return isUriLocation(value) || isLocalPathLocation(value)
}

// hideUris prunes the data rather than each render branch checking: an array
// of objects reaches the data grid and ArrayValue, which print locations too
function withoutLocations(
  attributes: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(attributes)
      .filter(([, value]) => !isLocation(value))
      .map(([key, value]) => [key, valueWithoutLocations(value)]),
  )
}

function valueWithoutLocations(value: unknown): unknown {
  return Array.isArray(value)
    ? value.filter(v => !isLocation(v)).map(valueWithoutLocations)
    : isObject(value)
      ? withoutLocations(value)
      : value
}

/**
 * The widest label `Attributes` will actually render under `attributes`, in
 * text units — the padding is added once by `widestLabel`, not per level.
 *
 * Follows the same branches the render below does: a flat array is one labelled
 * row, an array of objects renders each element as its own block with no label
 * at this level, a data grid heads its own grid rather than sharing a row, a
 * `UriLocation` is one field, any other object recurses. `Attributes.test.tsx`
 * fails if the two stop agreeing.
 */
function measureLabels(
  attributes: Record<string, unknown>,
  opts: {
    omits: Set<string>
    deepOmits: Set<string>
    prefix: string[]
  },
): number {
  const { omits, deepOmits, prefix } = opts
  let widest = 0
  const measure = (key: string) =>
    measureText([...prefix, key].join('.'), FIELD_NAME_FONT_SIZE)
  for (const [key, value] of Object.entries(attributes)) {
    if (value == null || omits.has(key)) {
      continue
    }
    if (Array.isArray(value)) {
      // a data grid's FieldName is a heading above the grid, not a cell beside
      // a value, so it takes no part in the column either
      if (!isHomogeneousObjectArray(value) && !isObjectArray(value)) {
        widest = Math.max(widest, measure(key))
      }
    } else if (isObject(value)) {
      widest = Math.max(
        widest,
        isUriLocation(value)
          ? measure(key)
          : measureLabels(value, {
              omits: deepOmits,
              deepOmits,
              prefix: [...prefix, key],
            }),
      )
    } else {
      widest = Math.max(widest, measure(key))
    }
  }
  return widest
}

function widestLabel(
  attributes: Record<string, unknown>,
  opts: Parameters<typeof measureLabels>[1],
) {
  return Math.ceil(measureLabels(attributes, opts)) + FIELD_NAME_PADDING
}

export default function Attributes(props: {
  attributes: Record<string, unknown>
  omit?: string[]
  omitSingleLevel?: string[]
  formatter?: FeatureFormatter
  fieldActions?: FieldActions
  descriptions?: Descriptors
  prefix?: string[]
  hideUris?: boolean
  /**
   * The label column's width, measured once for the whole card and threaded
   * down the recursion. Set by `Attributes` itself; a caller leaves it alone.
   */
  labelWidth?: number
}) {
  const {
    omit = [],
    omitSingleLevel = [],
    descriptions,
    formatter,
    fieldActions,
    hideUris,
    prefix = [],
    labelWidth,
  } = props
  const attributes = hideUris
    ? withoutLocations(props.attributes)
    : props.attributes

  const omits = new Set([...omit, ...globalOmit, ...omitSingleLevel])
  const shown = Object.entries(attributes).filter(
    ([k, v]) => v != null && !omits.has(k),
  )
  // Measured over the whole subtree on the outermost call, then handed down, so
  // one card has one label column. Per-level measurement put `type`/`trackId` in
  // a narrow column, `adapter.type` in a wider one and `adapter.craiLocation` in
  // a wider one still — three ragged steps down a single card.
  const width = Math.min(
    labelWidth ??
      widestLabel(attributes, {
        omits,
        // `omitSingleLevel` is what its name says: the recursive call below
        // passes only `omit` on, so the measurement must stop honoring it at
        // the same depth or it measures a label that isn't there
        deepOmits: omitSingleLevel.length
          ? new Set([...omit, ...globalOmit])
          : omits,
        prefix,
      }),
    MAX_FIELD_NAME_WIDTH,
  )

  return (
    <>
      {shown.map(([key, value]) => {
        const description = accessNested([...prefix, key], descriptions)
        if (Array.isArray(value)) {
          // Only use the data grid when schemas are homogeneous enough;
          // heterogeneous arrays fall through to ArrayValue which renders
          // each object as individual field sections instead of disappearing
          return isHomogeneousObjectArray(value) ? (
            <Suspense key={key} fallback={null}>
              <DataGridDetails name={key} prefix={prefix} value={value} />
            </Suspense>
          ) : (
            <ArrayValue
              key={key}
              name={key}
              value={value}
              formatter={formatter}
              fieldActions={fieldActions}
              description={description}
              prefix={prefix}
              width={width}
            />
          )
        } else if (isObject(value)) {
          return isUriLocation(value) ? (
            <UriField
              key={key}
              name={key}
              prefix={prefix}
              value={value}
              width={width}
            />
          ) : (
            <Attributes
              key={key}
              attributes={value}
              omit={omit}
              descriptions={descriptions}
              formatter={formatter}
              fieldActions={fieldActions}
              prefix={[...prefix, key]}
              labelWidth={width}
            />
          )
        } else {
          return (
            <SimpleField
              key={key}
              name={key}
              formatter={formatter}
              fieldActions={fieldActions}
              value={value}
              description={description}
              prefix={prefix}
              width={width}
            />
          )
        }
      })}
    </>
  )
}
