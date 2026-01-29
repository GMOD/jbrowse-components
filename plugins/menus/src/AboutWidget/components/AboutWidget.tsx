import { ExternalLink } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { getEnv } from '@jbrowse/mobx-state-tree'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

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

const AboutWidget = observer(function AboutWidget({
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
        {process.env.GIT_HASH ? `+${process.env.GIT_HASH}` : ''}
      </Typography>
      <Typography align="center">
        JBrowse is a <ExternalLink href="http://gmod.org/">GMOD</ExternalLink>{' '}
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
                    <ExternalLink href={url}>{text}</ExternalLink>
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
