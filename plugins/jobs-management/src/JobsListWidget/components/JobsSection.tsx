import type { ReactNode } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Button,
  Card,
  CardContent,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { JobModel } from '../jobModel.ts'

const useStyles = makeStyles()(theme => ({
  expandIcon: {
    color: theme.palette.tertiary.contrastText,
  },
  summaryTitle: {
    flexGrow: 1,
  },
}))

const JobsSection = observer(function JobsSection({
  title,
  jobs,
  emptyText,
  renderCard,
  onClear,
}: {
  title: string
  jobs: JobModel[]
  emptyText: string
  renderCard: (job: JobModel) => ReactNode
  onClear?: () => void
}) {
  const { classes } = useStyles()
  return (
    <Accordion defaultExpanded>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon className={classes.expandIcon} />}
      >
        <Typography variant="h5" className={classes.summaryTitle}>
          {title}
        </Typography>
        {onClear && jobs.length ? (
          <Button
            component="span"
            size="small"
            onClick={e => {
              e.stopPropagation()
              onClear()
            }}
          >
            Clear
          </Button>
        ) : null}
      </AccordionSummary>
      <AccordionDetails>
        {jobs.length ? (
          jobs.map(job => renderCard(job))
        ) : (
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body1">{emptyText}</Typography>
            </CardContent>
          </Card>
        )}
      </AccordionDetails>
    </Accordion>
  )
})

export default JobsSection
