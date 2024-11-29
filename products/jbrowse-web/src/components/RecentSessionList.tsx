import React, { useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
import { List, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import RecentSessionCard from './RecentSessionCard'

import type { WebRootModel } from '../rootModel/rootModel'

const useStyles = makeStyles()({
  header: {
    margin: 8,
  },

  list: {
    overflow: 'auto',
    maxHeight: 200,
  },
})

const RecentSessionList = observer(function ({
  rootModel,
}: {
  rootModel: WebRootModel
}) {
  const { classes } = useStyles()
  const [error, setError] = useState<unknown>()
  return (
    <div>
      <Typography variant="h5" className={classes.header}>
        Recent sessions
      </Typography>
      <List className={classes.list}>
        {rootModel.savedSessions?.length ? (
          rootModel.savedSessions.map(session => (
            <RecentSessionCard
              key={session.session.id}
              rootModel={rootModel}
              sessionSnap={session}
              onError={e => {
                setError(e)
              }}
            />
          ))
        ) : (
          <div>No saved sessions</div>
        )}
      </List>
      {error ? <ErrorMessage error={error} /> : null}
    </div>
  )
})

export default RecentSessionList
