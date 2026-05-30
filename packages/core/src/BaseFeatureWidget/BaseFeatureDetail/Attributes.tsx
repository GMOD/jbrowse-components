import ArrayValue from './ArrayValue.tsx'
import DataGridDetails from './DataGridDetails.tsx'
import SimpleField from './SimpleField.tsx'
import UriAttribute from './UriField.tsx'
import { accessNested, generateMaxWidth } from './util.ts'
import { isObject, isUriLocation } from '../../util/index.ts'

import type { Descriptors } from '../types.tsx'

const MAX_FIELD_NAME_WIDTH = 170

// Max extra unique columns vs. first row before falling back to per-row field
// sections instead of the data grid (avoids a mostly-empty, hard-to-read grid)
const DATAGRID_SCHEMA_TOLERANCE = 5

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
  formatter?: (val: unknown, key: string, index?: number) => React.ReactNode
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
  const { __jbrowsefmt, ...rest } = attributes
  const filteredFormattedAttributes = Object.entries({
    ...rest,
    ...__jbrowsefmt,
  }).filter(([k, v]) => v != null && !omits.has(k))
  const maxLabelWidth = generateMaxWidth(filteredFormattedAttributes, prefix)

  return (
    <>
      {filteredFormattedAttributes.map(([key, value]) => {
        const description = accessNested([...prefix, key], descriptions)
        if (Array.isArray(value)) {
          if (value.length > 1 && value.every(v => isObject(v))) {
            const objArr = value as Record<string, unknown>[]
            const firstKeyCount = Object.keys(objArr[0]!).length
            const unionKeyCount = new Set(objArr.flatMap(v => Object.keys(v)))
              .size
            // Only use the data grid when schemas are homogeneous enough;
            // heterogeneous arrays fall through to ArrayValue which renders
            // each object as individual field sections instead of disappearing
            if (unionKeyCount < firstKeyCount + DATAGRID_SCHEMA_TOLERANCE) {
              return (
                <DataGridDetails
                  key={key}
                  name={key}
                  prefix={prefix}
                  value={objArr}
                />
              )
            }
          }
          return (
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
          const { omitSingleLevel, ...rest } = props
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
              {...rest}
              attributes={value}
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
