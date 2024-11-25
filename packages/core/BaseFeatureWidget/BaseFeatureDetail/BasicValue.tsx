import React from 'react'
import { Link } from '@mui/material'
import isObject from 'is-object'
import { makeStyles } from 'tss-react/mui'

// locals
import { SanitizedHTML } from '../../ui'

const useStyles = makeStyles()(theme => ({
  fieldValue: {
    wordBreak: 'break-word',
    maxHeight: 300,
    fontSize: 12,
    padding: theme.spacing(0.5),
    overflow: 'auto',
  },
}))

export default function BasicValue({ value }: { value: unknown }) {
  const { classes } = useStyles()
  const isLink = /^https?:\/\//.exec(`${value}`)
  return (
    <div className={classes.fieldValue}>
      {React.isValidElement(value) ? (
        value
      ) : isLink ? (
        <Link href={`${value}`}>{`${value}`}</Link>
      ) : (
        <SanitizedHTML
          html={isObject(value) ? JSON.stringify(value) : String(value)}
        />
      )}
    </div>
  )
}
