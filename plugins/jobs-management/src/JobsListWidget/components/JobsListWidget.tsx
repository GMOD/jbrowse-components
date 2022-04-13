import React from 'react'
import { observer } from 'mobx-react'

import {
  Accordion,
  AccordionSummary,
  Card,
  CardContent,
  Typography,
  makeStyles,
} from '@material-ui/core'

// icons
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'

import JobCard from './JobCard'
import CurrentJobCard from './CurrentJobCard'
import { JobsListModel, NewJob } from '../model'

const useStyles = makeStyles(theme => ({
  root: {
    margin: theme.spacing(1),
  },
  expandIcon: {
    color: '#fff',
  },
  button: {
    marginTop: theme.spacing(1),
    marginRight: theme.spacing(1),
  },
  adminBadge: {
    margin: '0.5em',
    borderRadius: 3,
    // this is the quaternary color in JB2 palette
    backgroundColor: '#FFB11D',
    padding: '1em',
    display: 'flex',
    alignContent: 'center',
  },
}))

function JobsListWidget({ model }: { model: JobsListModel }) {
  const classes = useStyles()
  const { jobs, finished } = model
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
