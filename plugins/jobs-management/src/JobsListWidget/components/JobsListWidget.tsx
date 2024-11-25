import React from 'react'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Accordion,
  AccordionSummary,
  Card,
  CardContent,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// icons

import CurrentJobCard from './CurrentJobCard'
import JobCard from './JobCard'
import type { JobsListModel, NewJob } from '../model'

const useStyles = makeStyles()(theme => ({
  root: {
    margin: theme.spacing(1),
  },
  expandIcon: {
    color: theme.palette.tertiary.contrastText,
  },
}))

const JobsListWidget = observer(function ({ model }: { model: JobsListModel }) {
  const { classes } = useStyles()
  const { jobs, finished, queued, aborted } = model
  return (
    <div className={classes.root}>
      <Accordion defaultExpanded>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon className={classes.expandIcon} />}
        >
          <Typography variant="h5">Running jobs</Typography>
        </AccordionSummary>
        {jobs.length ? (
          jobs.map((job: NewJob, index: number) => (
            <CurrentJobCard job={job} key={`${JSON.stringify(job)}-${index}`} />
          ))
        ) : (
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body1">No running jobs</Typography>
            </CardContent>
          </Card>
        )}
      </Accordion>
      <Accordion defaultExpanded>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon className={classes.expandIcon} />}
        >
          <Typography variant="h5">Queued jobs</Typography>
        </AccordionSummary>
        {queued.length ? (
          queued.map((job: NewJob, index: number) => (
            <JobCard job={job} key={`${JSON.stringify(job)}-${index}`} />
          ))
        ) : (
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body1">No queued jobs</Typography>
            </CardContent>
          </Card>
        )}
      </Accordion>
      <Accordion defaultExpanded>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon className={classes.expandIcon} />}
        >
          <Typography variant="h5">Completed jobs</Typography>
        </AccordionSummary>
        {finished.length ? (
          finished.map((job: NewJob, index: number) => (
            <JobCard key={`${JSON.stringify(job)}-${index}`} job={job} />
          ))
        ) : (
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body1">No completed jobs</Typography>
            </CardContent>
          </Card>
        )}
      </Accordion>
      <Accordion defaultExpanded>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon className={classes.expandIcon} />}
        >
          <Typography variant="h5">Aborted jobs</Typography>
        </AccordionSummary>
        {aborted.length ? (
          aborted.map((job: NewJob, index: number) => (
            <JobCard key={`${JSON.stringify(job)}-${index}`} job={job} />
          ))
        ) : (
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body1">No aborted jobs</Typography>
            </CardContent>
          </Card>
        )}
      </Accordion>
    </div>
  )
})

export default JobsListWidget
