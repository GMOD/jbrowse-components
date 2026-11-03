import { Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import { cx, makeStyles } from '../../util/tss-react/index.ts'

const useStyles = makeStyles()(theme => ({
  fieldDescription: {
    textDecoration: 'underline dotted',
    textUnderlineOffset: 2,
    cursor: 'help',
    '&:hover, &:focus-visible': {
      background: theme.palette.action.selected,
    },
  },
  fieldName: {
    wordBreak: 'break-all',
    minWidth: 90,
    borderBottom: `1px solid ${theme.palette.divider}`,
    fontSize: 12,
    background: theme.palette.action.disabledBackground,
    marginRight: theme.spacing(1),
    padding: theme.spacing(0.5),
  },
}))

const FieldName = observer(function FieldName({
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
  const { classes } = useStyles()
  const val = [...prefix, name].join('.')
  return description ? (
    <Tooltip title={description} placement="left">
      <div
        tabIndex={0}
        className={cx(classes.fieldDescription, classes.fieldName)}
        style={{ width }}
      >
        {val}
      </div>
    </Tooltip>
  ) : (
    <div className={classes.fieldName} style={{ width }}>
      {val}
    </div>
  )
})

export default FieldName
