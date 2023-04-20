import React, { FC } from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import { AbstractSessionModel } from '@jbrowse/core/util'

import { FileSelector } from '@jbrowse/core/ui'
import { readConfObject } from '@jbrowse/core/configuration'
import type configSchema from './configSchema'
import { Instance } from 'mobx-state-tree'

const useStyles = makeStyles()(theme => ({
  root: {
    margin: theme.spacing(1),
  },
  expandIcon: {
    color: theme.palette.tertiary.contrastText,
  },
  adminBadge: {
    margin: '0.5em',
    borderRadius: 3,
    backgroundColor: theme.palette.quaternary.main,
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

const ConnectionConfigurator: FC<{
  model: { target: Instance<typeof configSchema> }
  session: AbstractSessionModel
}> = ({ model: { target: connectionConfig }, session }) => {
  const { classes } = useStyles()
  return (
    <div className={classes.root}>
      <FileSelector
        location={readConfObject(connectionConfig, 'hubTxtLocation')}
        setLocation={newLocation => {
          connectionConfig.hubTxtLocation.set(newLocation)
        }}
        name="Hub.txt File"
        description="Choose the location of the hub.txt file"
      />
    </div>
  )
}

export default observer(ConnectionConfigurator)
