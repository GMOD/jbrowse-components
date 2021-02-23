/* eslint-disable @typescript-eslint/no-explicit-any */
import Typography from '@material-ui/core/Typography'
import { observer } from 'mobx-react'
import { IAnyStateTreeNode } from 'mobx-state-tree'
import { getSession } from '@jbrowse/core/util'
import React from 'react'
import { makeStyles } from '@material-ui/core'
import Link from '@material-ui/core/Link'
import { PluginMetaData } from '@jbrowse/core/PluginManager'

const useStyles = makeStyles(theme => ({
  root: {
    margin: theme.spacing(2),
  },
  subtitle: {
    margin: theme.spacing(),
  },
  pluginList: {
    margin: theme.spacing(1),
  },
}))

interface BasePlugin {
  version?: string
  name: string
}

function About({ model }: { model: IAnyStateTreeNode }) {
  const classes = useStyles()
  const session = model
    ? getSession(model)
    : {
        // this is a slot definition
        version: '',
        pluginManager: {
          plugins: [],
          pluginMetaData: {} as Record<string, PluginMetaData>,
        },
      }
  const { pluginManager } = session
  const { plugins } = pluginManager
  const corePlugins = plugins
    .filter(p => Boolean(pluginManager.pluginMetaData[p.name]?.isCore))
    .map(p => p.name)

  return (
    <div className={classes.root}>
      <Typography variant="h4" align="center" color="primary">
        JBrowse 2
      </Typography>
      <Typography variant="h6" align="center" className={classes.subtitle}>
        {session.version}
      </Typography>
      <Typography align="center" variant="body2">
        JBrowse is a{' '}
        <Link href="http://gmod.org/" target="_blank" rel="noopener noreferrer">
          GMOD
        </Link>{' '}
        project
      </Typography>
      <br />
      <Typography align="center">
        © 2019-2021 The Evolutionary Software Foundation
      </Typography>
      <div className={classes.pluginList}>
        <Typography>External plugins loaded</Typography>
        <ul>
          {plugins
            .filter((plugin: BasePlugin) => {
              return !corePlugins.includes(plugin.name)
            })
            .map((plugin: BasePlugin) => {
              return (
                <li key={plugin.name}>
                  {plugin.name} {plugin.version}
                </li>
              )
            })}
        </ul>
        <Typography>Core plugins loaded</Typography>
        <ul>
          {plugins
            .filter((plugin: BasePlugin) => {
              return corePlugins.includes(plugin.name)
            })
            .map((plugin: BasePlugin) => {
              return (
                <li key={plugin.name}>
                  {plugin.name} {plugin.version}
                </li>
              )
            })}
        </ul>
      </div>
    </div>
  )
}

export default observer(About)
