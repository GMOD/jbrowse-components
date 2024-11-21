import React from 'react'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()(theme => ({
  bg: {
    padding: 4,
    margin: 4,
    overflow: 'auto',
    maxHeight: 200,
    background: theme.palette.mode === 'dark' ? '#833' : '#f88',
    border: `1px solid ${theme.palette.divider}`,
  },
}))

export default function RedErrorMessageBox({
  children,
}: {
  children: React.ReactNode
}) {
  const { classes } = useStyles()
  return <div className={classes.bg}>{children}</div>
}
