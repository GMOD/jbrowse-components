import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import JobsSection from './JobsSection.tsx'

import type { JobState } from '../jobModel.ts'
import type { JobsListModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  root: {
    margin: theme.spacing(1),
  },
}))

const sections: {
  state: JobState
  title: string
  emptyText: string
  clearable?: boolean
}[] = [
  { state: 'running', title: 'Running jobs', emptyText: 'No running jobs' },
  { state: 'queued', title: 'Queued jobs', emptyText: 'No queued jobs' },
  {
    state: 'finished',
    title: 'Completed jobs',
    emptyText: 'No completed jobs',
    clearable: true,
  },
  {
    state: 'aborted',
    title: 'Aborted jobs',
    emptyText: 'No aborted jobs',
    clearable: true,
  },
]

const JobsListWidget = observer(function JobsListWidget({
  model,
}: {
  model: JobsListModel
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.root}>
      {sections.map(({ state, title, emptyText, clearable }) => (
        <JobsSection
          key={state}
          title={title}
          jobs={model.jobs.filter(j => j.state === state)}
          emptyText={emptyText}
          onClear={
            clearable
              ? () => {
                  model.clearJobs(state)
                }
              : undefined
          }
        />
      ))}
    </div>
  )
})

export default JobsListWidget
