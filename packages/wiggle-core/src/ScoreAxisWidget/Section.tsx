import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { ReactNode } from 'react'

const useStyles = makeStyles()(theme => ({
  section: {
    display: 'grid',
    gap: theme.spacing(1),
  },
  heading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 30,
  },
  title: {
    fontWeight: 500,
  },
}))

const Section = observer(function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children?: ReactNode
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.section}>
      <div className={classes.heading}>
        <Typography variant="subtitle1" className={classes.title}>
          {title}
        </Typography>
        {action}
      </div>
      {children}
    </div>
  )
})

export default Section
