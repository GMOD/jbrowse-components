import { Box, Button, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import JobCard from './JobCard.tsx'

import type { JobModel } from '../jobModel.ts'

const JobsSection = observer(function JobsSection({
  title,
  jobs,
  onClear,
}: {
  title: string
  jobs: JobModel[]
  onClear?: () => void
}) {
  return (
    <Box component="section" sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', minHeight: 30 }}>
        <Typography
          variant="subtitle2"
          color="text.secondary"
          component="h2"
          sx={{ flexGrow: 1 }}
        >
          {title}
        </Typography>
        {onClear ? (
          <Button size="small" onClick={onClear}>
            Clear
          </Button>
        ) : null}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {jobs.map(job => (
          <JobCard key={job.name} job={job} />
        ))}
      </Box>
    </Box>
  )
})

export default JobsSection
