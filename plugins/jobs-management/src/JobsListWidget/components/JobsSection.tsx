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

import JobCard from './JobCard.tsx'

import type { JobModel } from '../jobModel.ts'

const useStyles = makeStyles()({
  summaryTitle: {
    flexGrow: 1,
  },
  clearRow: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
})

const JobsSection = observer(function JobsSection({
  title,
  jobs,
  emptyText,
  onClear,
}: {
  title: string
  jobs: JobModel[]
  emptyText: string
  onClear?: () => void
}) {
  const { classes } = useStyles()
  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="h5" className={classes.summaryTitle}>
          {title}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        {onClear && jobs.length ? (
          <div className={classes.clearRow}>
            <Button size="small" onClick={onClear}>
              Clear
            </Button>
          </div>
        ) : null}
        {jobs.length ? (
          jobs.map(job => <JobCard key={job.name} job={job} />)
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
