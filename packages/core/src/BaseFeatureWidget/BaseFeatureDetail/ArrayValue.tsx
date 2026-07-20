import { useState } from 'react'

import { isObject } from '../../util/index.ts'
import { makeStyles } from '../../util/tss-react/index.ts'
import Attributes from './Attributes.tsx'
import BasicValue from './BasicValue.tsx'
import FieldName from './FieldName.tsx'

import type { FeatureFormatter } from '../types.tsx'

const MAX_ARRAY_LENGTH = 100

// Numeric arrays (e.g. base-modification probabilities, per-base scores) are
// rarely read element-by-element and can be thousands long, so only a handful
// are shown until expanded
const MAX_NUMERIC_ARRAY_LENGTH = 5

const useStyles = makeStyles()(theme => ({
  field: {
    display: 'flex',
    flexWrap: 'wrap',
  },

  fieldSubvalue: {
    wordBreak: 'break-word',
    maxHeight: 300,
    padding: theme.spacing(0.5),
    border: `1px solid ${theme.palette.action.selected}`,
    boxSizing: 'border-box',
    overflow: 'auto',
  },
}))

export default function ArrayValue({
  name,
  value,
  description,
  formatter,
  prefix = [],
}: {
  description?: React.ReactNode
  name: string
  value: unknown[]
  formatter?: FeatureFormatter
  prefix?: string[]
}) {
  const { classes } = useStyles()
  const [showAll, setShowAll] = useState(false)
  const limit = value.every(v => typeof v === 'number')
    ? MAX_NUMERIC_ARRAY_LENGTH
    : MAX_ARRAY_LENGTH
  const needsTruncation = value.length > limit
  const displayedValues =
    needsTruncation && !showAll ? value.slice(0, limit) : value

  return value.every(isObject) ? (
    value.length === 1 ? (
      <Attributes
        formatter={formatter}
        attributes={value[0]!}
        prefix={[...prefix, name]}
      />
    ) : (
      <>
        {value.map((val, i) => (
          <Attributes
            // eslint-disable-next-line @eslint-react/no-array-index-key -- static positional list of attribute objects, no unique field available
            key={i}
            formatter={formatter}
            attributes={val}
            prefix={[...prefix, `${name}-${i}`]}
          />
        ))}
      </>
    )
  ) : (
    <div className={classes.field}>
      <FieldName prefix={prefix} description={description} name={name} />
      {value.length === 1 ? (
        <BasicValue
          value={formatter ? formatter(value[0], name, 0) : value[0]}
        />
      ) : (
        <>
          {displayedValues.map((val, i) => (
            // eslint-disable-next-line @eslint-react/no-array-index-key -- static positional list of primitive values, no unique field available
            <div key={`${String(val)}-${i}`} className={classes.fieldSubvalue}>
              <BasicValue value={formatter ? formatter(val, name, i) : val} />
            </div>
          ))}
          {needsTruncation ? (
            <button
              type="button"
              onClick={() => {
                setShowAll(v => !v)
              }}
            >
              {showAll
                ? 'Show less'
                : `Showing ${limit} of ${value.length}. Show all...`}
            </button>
          ) : null}
        </>
      )}
    </div>
  )
}
