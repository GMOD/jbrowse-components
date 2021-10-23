import React from 'react'
import { observer } from 'mobx-react'
import { IAnyStateTreeNode, getEnv } from 'mobx-state-tree'
import { getSession } from '@jbrowse/core/util'
import { makeStyles, Typography, Link } from '@material-ui/core'
import PluginManager from '@jbrowse/core/PluginManager'

const useStyles = makeStyles(theme => ({
  root: {
    margin: theme.spacing(2),
    paddingTop: theme.spacing(2),
  },
  subtitle: {
    margin: theme.spacing(),
  },
  pluginList: {
    margin: theme.spacing(1),
    marginTop: theme.spacing(5),
  },
}))

function About({ model }: { model: IAnyStateTreeNode }) {
  const classes = useStyles()
  const { version } = getSession(model)
  const { pluginManager } = getEnv(model)
  const { plugins } = pluginManager as PluginManager
  const corePlugins = plugins
    .filter(p => pluginManager.pluginMetadata[p.name]?.isCore)
    .map(p => p.name)

  const corePluginsRender = plugins
    .filter(plugin => {
      return corePlugins.includes(plugin.name)
    })
    .map(plugin => (
      <li key={plugin.name}>
        {plugin.name} {plugin.version || ''}
      </li>
    ))

  const externalPluginsRender = plugins
    .filter(plugin => !corePlugins.includes(plugin.name))
    .map(plugin => {
      const text = `${plugin.name} ${plugin.version || ''}`
      return (
        <li key={plugin.name}>
          {plugin.url ? (
            <Link target="_blank" rel="noopener noreferrer" href={plugin.url}>
              {text}
            </Link>
          ) : (
            text
          )}
        </li>
      )
    })

  return (
    <div className={classes.root}>
      <Typography variant="h4" align="center" color="primary">
        JBrowse 2
      </Typography>
      <Typography variant="h6" align="center" className={classes.subtitle}>
        {version}
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
        {!externalPluginsRender.length ? null : (
          <>
            <Typography variant="h6">External plugins loaded</Typography>
            <ul>{externalPluginsRender}</ul>
          </>
        )}
        {!corePluginsRender.length ? null : (
          <>
            <Typography variant="h6">Core plugins loaded</Typography>
            <ul>{corePluginsRender}</ul>
          </>
        )}
      </div>
    </div>
  )
}

export default observer(About)
