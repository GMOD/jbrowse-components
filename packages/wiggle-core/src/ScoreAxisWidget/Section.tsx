import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Typography } from '@mui/material'

import type { ReactNode } from 'react'

const useStyles = makeStyles()(theme => ({
  section: {
    display: 'grid',
    gap: theme.spacing(0.5),
  },
}))

export default function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.section}>
      <Typography variant="subtitle2">{title}</Typography>
      {children}
    </div>
  )
}
