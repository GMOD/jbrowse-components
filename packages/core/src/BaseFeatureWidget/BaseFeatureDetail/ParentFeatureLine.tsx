import { Typography } from '@mui/material'

import { makeStyles } from '../../util/tss-react/index.ts'

import type { ParentFeatureSummary } from '../types.tsx'

const useStyles = makeStyles()(theme => ({
  line: {
    padding: theme.spacing(0.5, 1, 0),
  },
}))

// Which gene a transcript came out of, above the card naming the transcript.
// The panel is opened on the exact isoform the click resolved to, and that
// isoform's own record is regularly the only place its accession appears --
// nothing in `NM_004006.2 - mRNA` says DMD.
export default function ParentFeatureLine({
  parentFeature,
}: {
  parentFeature: ParentFeatureSummary
}) {
  const { classes } = useStyles()
  const { name, type } = parentFeature
  return (
    <Typography
      variant="body2"
      color="textSecondary"
      className={classes.line}
      data-testid="parent-feature-line"
    >
      in {type ? `${type} ` : ''}
      {name}
    </Typography>
  )
}
