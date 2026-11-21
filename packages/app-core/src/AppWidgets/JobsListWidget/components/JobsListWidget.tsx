import { Box, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import JobsSection from './JobsSection.tsx'

import type { JobState } from '../jobModel.ts'
import type { JobsListModel } from '../model.ts'

const sections: { state: JobState; title: string; clearable: boolean }[] = [
  { state: 'running', title: 'Running jobs', clearable: false },
  { state: 'queued', title: 'Queued jobs', clearable: false },
  { state: 'finished', title: 'Completed jobs', clearable: true },
  { state: 'aborted', title: 'Aborted jobs', clearable: true },
]

const JobsListWidget = observer(function JobsListWidget({
  model,
}: {
  model: JobsListModel
}) {
  return (
    <Box sx={{ p: 1 }}>
      {model.jobs.length === 0 ? (
        <Typography color="text.secondary">No jobs</Typography>
      ) : (
        sections.map(({ state, title, clearable }) => {
          const jobs = model.jobs.filter(j => j.state === state)
          return jobs.length ? (
            <JobsSection
              key={state}
              title={title}
              jobs={jobs}
              onClear={
                clearable
                  ? () => {
                      model.clearJobs(state)
                    }
                  : undefined
              }
            />
          ) : null
        })
      )}
    </Box>
  )
})

export default JobsListWidget
