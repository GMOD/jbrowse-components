import React from 'react'
import isObject from 'is-object'

// locals
import ArrayValue from './ArrayValue'
import DataGridDetails from './DataGridDetails'
import SimpleField from './SimpleField'
import UriAttribute from './UriField'
import { accessNested, generateMaxWidth } from './util'
import { isUriLocation } from '../../util'

const MAX_FIELD_NAME_WIDTH = 170

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
]

export default function Attributes(props: {
  attributes: {
    [key: string]: unknown
    __jbrowsefmt?: Record<string, unknown>
  }
  omit?: string[]
  omitSingleLevel?: string[]
  formatter?: (val: unknown, key: string) => React.ReactNode
  descriptions?: Record<string, React.ReactNode>
  prefix?: string[]
  hideUris?: boolean
}) {
  const {
    attributes,
    omit = [],
    omitSingleLevel = [],
    descriptions,
    formatter = val => val,
    hideUris,
    prefix = [],
  } = props

  const omits = new Set([...omit, ...globalOmit, ...omitSingleLevel])
  const { __jbrowsefmt, ...rest } = attributes
  const formattedAttributes = { ...rest, ...__jbrowsefmt }

  const maxLabelWidth = generateMaxWidth(
    Object.entries(formattedAttributes).filter(
      ([k, v]) => v !== undefined && !omits.has(k),
    ),
    prefix,
  )

  return (
    <>
      {Object.entries(formattedAttributes)
        .filter(([k, v]) => v !== undefined && !omits.has(k))
        .map(([key, value]) => {
          const description = accessNested([...prefix, key], descriptions)
          if (Array.isArray(value)) {
            // check if it looks like an array of objects, which could be used
            // in data grid
            return value.length > 1 && value.every(val => isObject(val)) ? (
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
                descriptions={descriptions}
                prefix={[...prefix, key]}
              />
            )
          } else {
            return (
              <SimpleField
                key={key}
                name={key}
                value={formatter(value, key)}
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
