import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Typography,
} from '@mui/material'
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
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="h5" component="span">
          {title}
        </Typography>
      </AccordionSummary>
      <AccordionDetails
        sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 1 }}
      >
        {onClear ? (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button size="small" onClick={onClear}>
              Clear
            </Button>
          </Box>
        ) : null}
        {jobs.map(job => (
          <JobCard key={job.name} job={job} />
        ))}
      </AccordionDetails>
    </Accordion>
  )
})

export default JobsSection
