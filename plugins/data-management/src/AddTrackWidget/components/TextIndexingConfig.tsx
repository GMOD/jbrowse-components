import { makeStyles } from '@jbrowse/core/util/tss-react'
import { InputLabel, Paper } from '@mui/material'
import { observer } from 'mobx-react'

import EditableStringList from './EditableStringList.tsx'
import { defaultIndexingConf } from './util.ts'

import type { AddTrackModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  paper: {
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(1),
  },
}))

const TextIndexingConfig = observer(function TextIndexingConfig({
  model,
}: {
  model: AddTrackModel
}) {
  const { classes } = useStyles()
  const conf = model.textIndexingConf ?? defaultIndexingConf

  return (
    <Paper className={classes.paper}>
      <InputLabel>Indexing configuration</InputLabel>
      <EditableStringList
        label="Indexing attributes"
        testId="stringArrayAdd-attributes"
        values={conf.attributes}
        onChange={attributes => {
          model.setTextIndexingConf({ ...conf, attributes })
        }}
      />
      <EditableStringList
        label="Feature types to exclude"
        testId="stringArrayAdd-exclude"
        values={conf.exclude}
        onChange={exclude => {
          model.setTextIndexingConf({ ...conf, exclude })
        }}
      />
    </Paper>
  )
})

export default TextIndexingConfig
