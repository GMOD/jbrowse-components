import ExpandMore from '@mui/icons-material/ExpandMore'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import { makeStyles } from '../../util/tss-react/index.ts'

import type { BaseCardProps } from '../types.tsx'

const useStyles = makeStyles()(theme => ({
  expansionPanelDetails: {
    display: 'block',
    padding: theme.spacing(1),
  },
}))

const BaseCard = observer(function BaseCard({
  children,
  title,
  defaultExpanded = true,
}: BaseCardProps) {
  const { classes } = useStyles()
  return (
    <Accordion
      defaultExpanded={defaultExpanded}
      slotProps={{ transition: { unmountOnExit: true } }}
      data-testid={`BaseCard-${title}`}
    >
      <AccordionSummary expandIcon={<ExpandMore />}>
        <Typography variant="button">{title}</Typography>
      </AccordionSummary>
      <AccordionDetails className={classes.expansionPanelDetails}>
        {children}
      </AccordionDetails>
    </Accordion>
  )
})

export default BaseCard
