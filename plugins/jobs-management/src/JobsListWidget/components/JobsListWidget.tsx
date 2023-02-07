import React from 'react'
import {
  Accordion,
  AccordionSummary,
  Card,
  CardContent,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'

// icons
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

import JobCard from './JobCard'
import CurrentJobCard from './CurrentJobCard'
import { JobsListModel, NewJob } from '../model'

const useStyles = makeStyles()(theme => ({
  root: {
    margin: theme.spacing(1),
  },
  expandIcon: {
    color: theme.palette.tertiary.contrastText,
  },
  button: {
    marginTop: theme.spacing(1),
    marginRight: theme.spacing(1),
  },
  adminBadge: {
    margin: '0.5em',
    borderRadius: 3,
    backgroundColor: theme.palette.quaternary.main,
    padding: '1em',
    display: 'flex',
    alignContent: 'center',
  },
}))

function JobsListWidget({ model }: { model: JobsListModel }) {
  const { classes } = useStyles()
  const { jobs, finished, queued } = model
  return (
    <div className={classes.root}>
      <Accordion defaultExpanded>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon className={classes.expandIcon} />}
        >
          <Typography variant="h5">Jobs</Typography>
        </AccordionSummary>
        {jobs.length ? (
          jobs.map((job: NewJob, index: number) => (
            <CurrentJobCard job={job} key={`${JSON.stringify(job)}-${index}`} />
          ))
        ) : (
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body1">No jobs</Typography>
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
          <Typography variant="h5">Jobs completed</Typography>
        </AccordionSummary>
        {finished.length ? (
          finished.map((job: NewJob, index: number) => (
            <JobCard key={`${JSON.stringify(job)}-${index}`} job={job} />
          ))
        ) : (
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body1">No jobs completed</Typography>
            </CardContent>
          </Card>
        )}
      </Accordion>
    </div>
  )
}

export default observer(JobsListWidget)
