import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import CurrentJobCard from './CurrentJobCard.tsx'
import JobCard from './JobCard.tsx'
import JobsSection from './JobsSection.tsx'

import type { JobsListModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  root: {
    margin: theme.spacing(1),
  },
}))

const JobsListWidget = observer(function JobsListWidget({
  model,
}: {
  model: JobsListModel
}) {
  const { classes } = useStyles()
  const { jobs } = model
  return (
    <div className={classes.root}>
      <JobsSection
        title="Running jobs"
        jobs={jobs.filter(j => j.state === 'running')}
        emptyText="No running jobs"
        renderCard={job => <CurrentJobCard key={job.name} job={job} />}
      />
      <JobsSection
        title="Queued jobs"
        jobs={jobs.filter(j => j.state === 'queued')}
        emptyText="No queued jobs"
        renderCard={job => <JobCard key={job.name} job={job} />}
      />
      <JobsSection
        title="Completed jobs"
        jobs={jobs.filter(j => j.state === 'finished')}
        emptyText="No completed jobs"
        renderCard={job => <JobCard key={job.name} job={job} />}
        onClear={() => {
          model.clearJobs('finished')
        }}
      />
      <JobsSection
        title="Aborted jobs"
        jobs={jobs.filter(j => j.state === 'aborted')}
        emptyText="No aborted jobs"
        renderCard={job => <JobCard key={job.name} job={job} />}
        onClear={() => {
          model.clearJobs('aborted')
        }}
      />
    </div>
  )
})

export default JobsListWidget
