import { makeStyles } from '@jbrowse/core/util/tss-react'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Card,
  CardContent,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import CurrentJobCard from './CurrentJobCard.tsx'
import JobCard from './JobCard.tsx'

import type { JobsListModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  root: {
    margin: theme.spacing(1),
  },
  expandIcon: {
    color: theme.palette.tertiary.contrastText,
  },
}))

const JobsListWidget = observer(function JobsListWidget({
  model,
}: {
  model: JobsListModel
}) {
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
        <AccordionDetails>
          {jobs.length ? (
            jobs.map(job => <CurrentJobCard job={job} key={job.name} />)
          ) : (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="body1">No running jobs</Typography>
              </CardContent>
            </Card>
          )}
        </AccordionDetails>
      </Accordion>
      <Accordion defaultExpanded>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon className={classes.expandIcon} />}
        >
          <Typography variant="h5">Queued jobs</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {queued.length ? (
            queued.map(job => <JobCard job={job} key={job.name} />)
          ) : (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="body1">No queued jobs</Typography>
              </CardContent>
            </Card>
          )}
        </AccordionDetails>
      </Accordion>
      <Accordion defaultExpanded>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon className={classes.expandIcon} />}
        >
          <Typography variant="h5">Completed jobs</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {finished.length ? (
            finished.map(job => <JobCard key={job.name} job={job} />)
          ) : (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="body1">No completed jobs</Typography>
              </CardContent>
            </Card>
          )}
        </AccordionDetails>
      </Accordion>
      <Accordion defaultExpanded>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon className={classes.expandIcon} />}
        >
          <Typography variant="h5">Aborted jobs</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {aborted.length ? (
            aborted.map(job => <JobCard key={job.name} job={job} />)
          ) : (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="body1">No aborted jobs</Typography>
              </CardContent>
            </Card>
          )}
        </AccordionDetails>
      </Accordion>
    </div>
  )
})

export default JobsListWidget
