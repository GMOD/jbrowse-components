import ArrayValue from './ArrayValue.tsx'
import DataGridDetails from './DataGridDetails.tsx'
import SimpleField from './SimpleField.tsx'
import UriAttribute from './UriField.tsx'
import { accessNested, applyFeatureFormatting, generateMaxWidth } from './util.ts'
import { isObject, isUriLocation } from '../../util/index.ts'

import type { Descriptors, FeatureFormatter } from '../types.tsx'

const MAX_FIELD_NAME_WIDTH = 170

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
  'parentId',
  'thickStart',
  'thickEnd',
  '_lineHash',
]

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
}) {
  const {
    attributes,
    omit = [],
    omitSingleLevel = [],
    descriptions,
    formatter,
    hideUris,
    prefix = [],
  } = props

  const omits = new Set([...omit, ...globalOmit, ...omitSingleLevel])
  const filteredFormattedAttributes = Object.entries(
    applyFeatureFormatting(attributes),
  ).filter(([k, v]) => v != null && !omits.has(k))
  const maxLabelWidth = generateMaxWidth(filteredFormattedAttributes, prefix)

  return (
    <>
      {filteredFormattedAttributes.map(([key, value]) => {
        const description = accessNested([...prefix, key], descriptions)
        if (Array.isArray(value)) {
          // Only use the data grid when schemas are homogeneous enough;
          // heterogeneous arrays fall through to ArrayValue which renders
          // each object as individual field sections instead of disappearing
          return isHomogeneousObjectArray(value) ? (
            <DataGridDetails
              key={key}
              name={key}
              prefix={prefix}
              value={value}
            />
          ) : (
            <ArrayValue
              key={key}
              name={key}
              value={value}
              formatter={formatter}
              description={description}
              prefix={prefix}
            />
          )
        } else if (isObject(value)) {
          return isUriLocation(value) ? (
            hideUris ? null : (
              <UriAttribute
                key={key}
                name={key}
                prefix={prefix}
                value={value}
              />
            )
          ) : (
            <Attributes
              key={key}
              attributes={value}
              omit={omit}
              descriptions={descriptions}
              formatter={formatter}
              hideUris={hideUris}
              prefix={[...prefix, key]}
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
              width={Math.min(maxLabelWidth, MAX_FIELD_NAME_WIDTH)}
            />
          )
        }
      })}
    </>
  )
}
