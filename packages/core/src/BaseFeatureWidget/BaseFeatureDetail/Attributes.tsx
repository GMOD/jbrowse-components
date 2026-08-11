import { Suspense, lazy } from 'react'

import {
  isLocalPathLocation,
  isObject,
  isUriLocation,
} from '../../util/index.ts'
import { measureText } from '../../util/index.ts'
import ArrayValue, { isObjectArray } from './ArrayValue.tsx'
import SimpleField from './SimpleField.tsx'
import UriAttribute from './UriField.tsx'
import { accessNested, applyFeatureFormatting } from './util.ts'

import type { Descriptors, FeatureFormatter } from '../types.tsx'

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
  '__jbrowsefmt',
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

/**
 * The widest label `Attributes` will actually render under `attributes`, in
 * text units — the padding is added once by `widestLabel`, not per level.
 *
 * Follows the same branches the render below does: a flat array is one labelled
 * row (`rendersOwnFieldRow`), an array of objects renders each element as its
 * own block with no label at this level, a data grid heads its own grid rather
 * than sharing a row, a `UriLocation` is one field, any other object recurses.
 * Kept next to the render for that reason — the two agree by being read
 * together, and `Attributes.test.tsx` fails if they stop.
 */
function measureLabels(
  attributes: Record<string, unknown>,
  opts: {
    omits: Set<string>
    deepOmits: Set<string>
    hideUris?: boolean
    prefix: string[]
  },
): number {
  const { omits, deepOmits, hideUris, prefix } = opts
  let widest = 0
  const measure = (key: string) =>
    measureText([...prefix, key].join('.'), FIELD_NAME_FONT_SIZE)
  for (const [key, value] of Object.entries(
    applyFeatureFormatting(attributes),
  )) {
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
      if (hideUris && (isUriLocation(value) || isLocalPathLocation(value))) {
        continue
      }
      widest = Math.max(
        widest,
        isUriLocation(value)
          ? measure(key)
          : measureLabels(value, {
              omits: deepOmits,
              deepOmits,
              hideUris,
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
  attributes: {
    [key: string]: unknown
    __jbrowsefmt?: Record<string, unknown>
  }
  omit?: string[]
  omitSingleLevel?: string[]
  formatter?: FeatureFormatter
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
    attributes,
    omit = [],
    omitSingleLevel = [],
    descriptions,
    formatter,
    hideUris,
    prefix = [],
    labelWidth,
  } = props

  const omits = new Set([...omit, ...globalOmit, ...omitSingleLevel])
  const filteredFormattedAttributes = Object.entries(
    applyFeatureFormatting(attributes),
  ).filter(([k, v]) => v != null && !omits.has(k))
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
        hideUris,
        prefix,
      }),
    MAX_FIELD_NAME_WIDTH,
  )

  return (
    <>
      {filteredFormattedAttributes.map(([key, value]) => {
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
              description={description}
              prefix={prefix}
              width={width}
            />
          )
        } else if (isObject(value)) {
          // hideUris means "don't show where the data sits". A LocalPathLocation
          // says that as plainly as a UriLocation does — it is what desktop and
          // `jbrowse add-track --load copy` write — and it used to fall through
          // to the recursive branch below and print the path in full
          if (
            hideUris &&
            (isUriLocation(value) || isLocalPathLocation(value))
          ) {
            return null
          }
          return isUriLocation(value) ? (
            <UriAttribute
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
              hideUris={hideUris}
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
