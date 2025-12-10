import { makeStyles } from '@jbrowse/core/util/tss-react'

import Attributes from './Attributes'
import BasicValue from './BasicValue'
import FieldName from './FieldName'
import { isObject } from '../../util'

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
  formatter?: (value: unknown, key: string) => React.ReactNode
  prefix?: string[]
}) {
  const { classes } = useStyles()
  if (value.length === 1) {
    return isObject(value[0]) ? (
      <Attributes
        formatter={formatter}
        attributes={value[0]}
        prefix={[...prefix, name]}
      />
    ) : (
      <div className={classes.field}>
        <FieldName prefix={prefix} description={description} name={name} />
        <BasicValue value={formatter ? formatter(value[0], name) : value[0]} />
      </div>
    )
  } else if (value.every(val => isObject(val))) {
    return (
      <>
        {value.map((val, i) => (
          <Attributes
            key={`${JSON.stringify(val)}-${i}`}
            formatter={formatter}
            attributes={val as Record<string, unknown>}
            prefix={[...prefix, `${name}-${i}`]}
          />
        ))}
      </>
    )
  } else {
    return (
      <div className={classes.field}>
        <FieldName prefix={prefix} description={description} name={name} />
        {value.map((val, i) => (
          <div
            key={`${JSON.stringify(val)}-${i}`}
            className={classes.fieldSubvalue}
          >
            <BasicValue value={formatter ? formatter(val, name) : val} />
          </div>
        ))}
      </div>
    )
  }
}
