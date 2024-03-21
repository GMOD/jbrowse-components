import React from 'react'
import { Tooltip } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()(theme => ({
  fieldDescription: {
    '&:hover': {
      background: theme.palette.mode === 'dark' ? '#e65100' : 'yellow',
    },
  },
  fieldName: {
    background: theme.palette.action.disabledBackground,
    borderBottom: '1px solid #0003',
    fontSize: 12,
    marginRight: theme.spacing(1),
    minWidth: 90,
    padding: theme.spacing(0.5),
    wordBreak: 'break-all',
  },
}))

export default function FieldName({
  description,
  name,
  width,
  prefix = [],
}: {
  description?: React.ReactNode
  name: string
  prefix?: string[]
  width?: number
}) {
  const { classes, cx } = useStyles()
  const val = [...prefix, name].join('.')
  return description ? (
    <Tooltip title={description} placement="left">
      <div className={cx(classes.fieldDescription, classes.fieldName)}>
        {val}
      </div>
    </Tooltip>
  ) : (
    <div className={classes.fieldName} style={{ width: width }}>
      {val}
    </div>
  )
}
