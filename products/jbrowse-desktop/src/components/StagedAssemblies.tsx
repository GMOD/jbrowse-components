import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Box, Chip, Typography } from '@mui/material'

import type { AssemblyConf } from '@jbrowse/core/util/assemblyConfigUtils'

const useStyles = makeStyles()(theme => ({
  stagedAssemblies: {
    margin: theme.spacing(2),
    padding: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
  },
  chip: {
    margin: 2,
  },
}))

export default function StagedAssemblies({
  assemblyConfs,
  onDelete,
}: {
  assemblyConfs: AssemblyConf[]
  onDelete: (name: string) => void
}) {
  const { classes } = useStyles()
  return (
    <Box className={classes.stagedAssemblies}>
      <Typography variant="body2" gutterBottom>
        Staged genomes (loaded together when you click Open):
      </Typography>
      {assemblyConfs.map(conf => (
        <Chip
          key={conf.name}
          className={classes.chip}
          label={conf.name}
          onDelete={() => {
            onDelete(conf.name)
          }}
        />
      ))}
    </Box>
  )
}
