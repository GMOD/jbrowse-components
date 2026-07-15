import { readConfObject } from '@jbrowse/core/configuration'
import { ExternalLink } from '@jbrowse/core/ui'
import { preferredRenderer } from '@jbrowse/core/ui/getGraphicsCapabilities'
import { useGraphicsCapabilities } from '@jbrowse/core/ui/useGraphicsCapabilities'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { getEnv } from '@jbrowse/mobx-state-tree'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Typography,
} from '@mui/material'
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
  accordions: {
    marginTop: theme.spacing(3),
  },
  icon: {
    color: theme.palette.tertiary.contrastText || '#fff',
  },
}))

const AboutWidget = observer(function AboutWidget({
  model,
}: {
  model: IAnyStateTreeNode
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const { version, gitCommit } = session
  const { pluginManager } = getEnv(model)
  const { plugins } = pluginManager as PluginManager
  const graphicsCapabilities = useGraphicsCapabilities()
  const { mainConfiguration, defaultDriverName } = session.rpcManager
  const defaultRpcDriver =
    (readConfObject(mainConfiguration, 'defaultDriver') as string) ||
    defaultDriverName
  const corePlugins = new Set(
    plugins
      .filter(p => pluginManager.pluginMetadata[p.name]?.isCore)
      .map(p => p.name),
  )
  const externalPlugins = plugins.filter(
    plugin => !corePlugins.has(plugin.name),
  )

  return (
    <div className={classes.root}>
      <Typography variant="h4" align="center">
        JBrowse 2
      </Typography>
      <Typography variant="h6" align="center" className={classes.subtitle}>
        {version}
      </Typography>
      {gitCommit ? (
        <Typography variant="body2" align="center">
          Commit: {gitCommit}
        </Typography>
      ) : null}
      <Typography align="center">
        JBrowse is a <ExternalLink href="https://gmod.org/">GMOD</ExternalLink>{' '}
        project
      </Typography>
      <br />
      <Typography align="center">
        © 2019-2026 The Evolutionary Software Foundation
      </Typography>

      <div className={classes.accordions}>
        <Accordion defaultExpanded>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon className={classes.icon} />}
          >
            <Typography>Browser settings</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <ul>
              {graphicsCapabilities ? (
                <li>Graphics: {preferredRenderer(graphicsCapabilities)}</li>
              ) : null}
              <li>
                Rendering:{' '}
                {defaultRpcDriver === 'WebWorkerRpcDriver'
                  ? 'off main thread'
                  : 'on main thread'}
              </li>
            </ul>
          </AccordionDetails>
        </Accordion>

        <Accordion defaultExpanded>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon className={classes.icon} />}
          >
            <Typography>Plugins loaded</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography>External plugins</Typography>
            {externalPlugins.length ? (
              <ul>
                {externalPlugins.map(plugin => {
                  const { url, name, version = '' } = plugin
                  const text = `${name} ${version || ''}`
                  return (
                    <li key={plugin.name}>
                      {plugin.url ? (
                        <ExternalLink href={url}>{text}</ExternalLink>
                      ) : (
                        <span>{text}</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <Typography>No external plugins loaded</Typography>
            )}
            <Typography>Core plugins</Typography>
            <ul>
              {plugins
                .filter(plugin => corePlugins.has(plugin.name))
                .map(plugin => (
                  <li key={plugin.name}>
                    {plugin.name} {plugin.version || ''}
                  </li>
                ))}
            </ul>
          </AccordionDetails>
        </Accordion>
      </div>
    </div>
  )
})

export default AboutWidget
