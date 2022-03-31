import React from 'react'
import { observer } from 'mobx-react'
import { getParent } from 'mobx-state-tree'

import { Button, Typography, makeStyles } from '@material-ui/core'

import { getSession, isElectron } from '@jbrowse/core/util'
import { JobsListModel } from '../model'

const useStyles = makeStyles(theme => ({
  root: {
    margin: theme.spacing(1),
  },
  expandIcon: {
    color: '#fff',
  },
  button: {
    marginTop: theme.spacing(1),
    marginRight: theme.spacing(1),
  },
  adminBadge: {
    margin: '0.5em',
    borderRadius: 3,
    // this is the quaternary color in JB2 palette
    backgroundColor: '#FFB11D',
    padding: '1em',
    display: 'flex',
    alignContent: 'center',
  },
  customPluginButton: {
    margin: '0.5em',
    display: 'flex',
    justifyContent: 'center',
  },
}))

interface TrackTextIndexing {
  attributes: string[]
  exclude: string[]
  assemblies: string[]
  tracks: string[] // trackIds
  indexType: string
  timestamp: number
  name: string
}

type jobsEntry = {
  progressPct?: number // if defined, gives the current pct progress expressed between 0 and 100. if undefined, renders an "indefinite" progress bar or spinner or something like that
  cancelCallback?: () => void // if defined, drawer widget will show a cancel button that calls this callback to cancel it. does not remove from the state tree though, the calling code needs to explicitly do that when the cancellation succeeds. it might throw an exception as well, remember
  name: string // displayed to user, required to be unique
  statusMessage?: string // displayed to user, smaller message about what the job is doing right now
}

function JobsListWidget({ model }: { model: JobsListModel }) {
  const classes = useStyles()
  const session = getSession(model)
  const rootModel = getParent(model, 3)
  const { indexingQueue, finishedJobs } = rootModel
  return (
    <div className={classes.root}>
      <Typography>Queued jobs</Typography>
      {indexingQueue.slice(1).map((job: TrackTextIndexing) => (
        <div key={JSON.stringify(job)}>{job.name}</div>
      ))}

      <Typography>Currently running job</Typography>
      {indexingQueue.length > 0 ? (
        <div key={JSON.stringify(indexingQueue[0])}>
          {indexingQueue[0].name}
        </div>
      ) : null}

      <Typography>Finished jobs</Typography>
      {finishedJobs.map((job: TrackTextIndexing) => (
        <div key={JSON.stringify(job)}>{job.name}</div>
      ))}

      <Button
        onClick={() => {
          //   model.clearData()
          // @ts-ignore
          session.hideWidget(model)
        }}
        className={classes.button}
      >
        Close
      </Button>
    </div>
  )
}

export default observer(JobsListWidget)
