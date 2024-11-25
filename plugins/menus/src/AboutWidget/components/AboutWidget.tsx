import React from 'react'
import { getSession } from '@jbrowse/core/util'
import { Typography, Link } from '@mui/material'
import { observer } from 'mobx-react'
import { getEnv } from 'mobx-state-tree'
import { makeStyles } from 'tss-react/mui'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { IAnyStateTreeNode } from 'mobx-state-tree'

const useStyles = makeStyles()(theme => ({
  root: {
    margin: theme.spacing(2),
    paddingTop: theme.spacing(2),
  },
  subtitle: {
    margin: theme.spacing(1),
  },
  pluginList: {
    margin: theme.spacing(1),
    marginTop: theme.spacing(5),
  },
}))

const AboutWidget = observer(function ({
  model,
}: {
  model: IAnyStateTreeNode
}) {
  const { classes } = useStyles()
  const { version } = getSession(model)
  const { pluginManager } = getEnv(model)
  const { plugins } = pluginManager as PluginManager
  const corePlugins = new Set(
    plugins
      .filter(p => pluginManager.pluginMetadata[p.name]?.isCore)
      .map(p => p.name),
  )

  return (
    <div className={classes.root}>
      <Typography variant="h4" align="center">
        JBrowse 2
      </Typography>
      <Typography variant="h6" align="center" className={classes.subtitle}>
        {version}
      </Typography>
      <Typography align="center">
        JBrowse is a{' '}
        <Link href="http://gmod.org/" target="_blank" rel="noopener noreferrer">
          GMOD
        </Link>{' '}
        project
      </Typography>
      <br />
      <Typography align="center">
        © 2019-2022 The Evolutionary Software Foundation
      </Typography>
      <div className={classes.pluginList}>
        <Typography>External plugins loaded</Typography>
        <ul>
          {plugins
            .filter(plugin => !corePlugins.has(plugin.name))
            .map(plugin => {
              const { url, name, version = '' } = plugin
              const text = `${name} ${version || ''}`
              return (
                <li key={plugin.name}>
                  {plugin.url ? (
                    <Link target="_blank" rel="noopener noreferrer" href={url}>
                      {text}
                    </Link>
                  ) : (
                    <Typography>{text}</Typography>
                  )}
                </li>
              )
            })}
        </ul>
        <Typography>Core plugins loaded</Typography>
        <ul>
          {plugins
            .filter(plugin => corePlugins.has(plugin.name))
            .map(plugin => (
              <li key={plugin.name}>
                <Typography>
                  {plugin.name} {plugin.version || ''}
                </Typography>
              </li>
            ))}
        </ul>
      </div>
    </div>
  )
})

export default AboutWidget
