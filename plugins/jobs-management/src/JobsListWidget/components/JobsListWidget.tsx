// import React, { useEffect, useState } from 'react'
import React from 'react'
import { observer } from 'mobx-react'
// import { getParent } from 'mobx-state-tree'

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

type jobType = 'indexing' | 'test'

export interface JobsEntry {
  name: string // displayed to user, required to be unique
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any
  progressPct?: number
  /* if defined, gives the current pct progress expressed between 0 and 100.
  if undefined, renders an "indefinite" progress bar or spinner */
  statusMessage?: string
  cancelCallback?: () => void
  /* if defined, drawer widget will show a cancel button that calls this callback
  to cancel it. does not remove from the state tree though, the calling code needs
  to explicitly do that when the cancellation succeeds. it might throw an exception
  as well, remember */
  jobType?: jobType
}

function JobsListWidget({ model }: { model: JobsListModel }) {
  const classes = useStyles()
  const { jobs, finished } = model
  // const rootModel = getParent(model, 3)
  // const { jobsManager } = rootModel
  // const { jobsQueue, finishedJobs } = jobsManager
  return (
    <div className={classes.root}>
      {/* <Typography variant="h5">Currently running job</Typography> */}
      {/* {jobs.length > 0 ? (
        <CurrentJobCard
          key={JSON.stringify(jobsQueue[0])}
          job={jobsQueue[0]}
          model={model}
        />
      ) : (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="body1">No job currently running</Typography>
          </CardContent>
        </Card>
      )} */}
      <Accordion defaultExpanded>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon className={classes.expandIcon} />}
        >
          <Typography variant="h5">Jobs</Typography>
        </AccordionSummary>
        {jobs.length ? (
          jobs.map((job: NewJob) => (
            <CurrentJobCard model={model} job={job} key={JSON.stringify(job)} />
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
          finished.map((job: NewJob) => (
            <JobCard key={JSON.stringify(job)} job={job} />
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
