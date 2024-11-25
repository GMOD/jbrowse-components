import React from 'react'
import ExpandMore from '@mui/icons-material/ExpandMore'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'

// icons

import type { BaseCardProps } from '../types'

const useStyles = makeStyles()(theme => ({
  expansionPanelDetails: {
    display: 'block',
    padding: theme.spacing(1),
  },
  icon: {
    color: theme.palette.tertiary.contrastText || '#fff',
  },
}))

export default function BaseCard({
  children,
  title,
  defaultExpanded = true,
}: BaseCardProps) {
  const { classes } = useStyles()
  return (
    <Accordion defaultExpanded={defaultExpanded}>
      <AccordionSummary expandIcon={<ExpandMore className={classes.icon} />}>
        <Typography variant="button">{title}</Typography>
      </AccordionSummary>
      <AccordionDetails className={classes.expansionPanelDetails}>
        {children}
      </AccordionDetails>
    </Accordion>
  )
}
