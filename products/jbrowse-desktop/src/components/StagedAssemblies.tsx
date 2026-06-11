import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Box, Chip, Typography } from '@mui/material'

import type { AssemblyConf } from './util.ts'

const useStyles = makeStyles()(theme => ({
  stagedAssemblies: {
    background: theme.palette.success.light,
    margin: theme.spacing(2),
    padding: theme.spacing(2),
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
        Staged assemblies:
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
