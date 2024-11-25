import React from 'react'
import isObject from 'is-object'
import { makeStyles } from 'tss-react/mui'

// locals
import Attributes from './Attributes'
import BasicValue from './BasicValue'
import FieldName from './FieldName'

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
  prefix = [],
}: {
  description?: React.ReactNode
  name: string
  value: unknown[]
  prefix?: string[]
}) {
  const { classes } = useStyles()
  if (value.length === 1) {
    return isObject(value[0]) ? (
      <Attributes attributes={value[0]} prefix={[...prefix, name]} />
    ) : (
      <div className={classes.field}>
        <FieldName prefix={prefix} description={description} name={name} />
        <BasicValue value={value[0]} />
      </div>
    )
  } else if (value.every(val => isObject(val))) {
    return (
      <>
        {value.map((val, i) => (
          <Attributes
            key={`${JSON.stringify(val)}-${i}`}
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
            <BasicValue value={val} />
          </div>
        ))}
      </div>
    )
  }
}
