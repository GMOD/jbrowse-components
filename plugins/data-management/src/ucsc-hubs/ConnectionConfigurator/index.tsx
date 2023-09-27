import React, { FC, useMemo } from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import { AbstractSessionModel } from '@jbrowse/core/util'

import { FileSelector } from '@jbrowse/core/ui'
import { getConf } from '@jbrowse/core/configuration'
import type configSchema from '../configSchema'
import { Instance, getSnapshot } from 'mobx-state-tree'
import ConfiguratorState from './model'
import { getAssemblies } from '../model/configure-utils'

const useStyles = makeStyles()(theme => ({
  root: {
    margin: theme.spacing(1),
  },
}))

const ConnectionConfigurator: FC<{
  connectionConfiguration: Instance<typeof configSchema>
  session: AbstractSessionModel
}> = ({ connectionConfiguration, session }) => {
  // we use our own little internal MST tree for state management
  const model = useMemo(
    () =>
      ConfiguratorState.create({
        configuration: getSnapshot(connectionConfiguration),
      }),
    [connectionConfiguration],
  )

  const { classes } = useStyles()
  if (!model) {
    return <div>Loading model...</div>
  }

  const hubData = model.hubData
  const assemblies = hubData ? getAssemblies(hubData, session) : undefined
  return (
    <div className={classes.root}>
      <FileSelector
        location={getConf(model, 'hubTxtLocation')}
        setLocation={newLocation => {
          model.configuration.hubTxtLocation.set(newLocation)
        }}
        error={model.state === 'invalid'}
        name="Hub.txt File"
        description={
          model.state === 'invalid'
            ? model.message
            : 'Enter the location of the hub.txt file'
        }
      />

      {assemblies
        ? [...assemblies.entries()].map(([name, { isNew, conf }]) => {
            return <div>{name}</div>
          })
        : null}
    </div>
  )
}

export default observer(ConnectionConfigurator)
