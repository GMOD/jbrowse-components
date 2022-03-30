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
  const { adminMode } = session
  const rootModel = getParent(model, 3)
  const { indexingQueue } = rootModel
  console.log(indexingQueue)
  //   const { jbrowse, adminMode } = rootModel
  if (indexingQueue.length) {
    indexingQueue.forEach((job: TrackTextIndexing) => {
      console.log(job)
    })
  }
  return (
    <div className={classes.root}>
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
