import { pluginLabel } from '@jbrowse/core/pluginDefinitions'
import { getSession, installedVersionFromUrl } from '@jbrowse/core/util'
import { isSessionWithPermanentPlugins } from '@jbrowse/core/util/types'
import { List, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import InstalledPlugin from './InstalledPlugin.tsx'
import UnloadedPermanentPlugin from './UnloadedPermanentPlugin.tsx'
import { unloadedPermanentPlugins } from './util.ts'

import type { PluginStoreModel } from '../model.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { JBrowsePlugin } from '@jbrowse/core/util/types'

const InstalledPluginsList = observer(function InstalledPluginsList({
  pluginManager,
  model,
  storePlugins,
}: {
  pluginManager: PluginManager
  model: PluginStoreModel
  storePlugins?: JBrowsePlugin[]
}) {
  const { plugins } = pluginManager
  const { filterText } = model
  const session = getSession(model)
  const matches = (text: string) =>
    text.toLowerCase().includes(filterText.toLowerCase())

  const externalPlugins = plugins.filter(
    p => !pluginManager.pluginMetadata[p.name]?.isCore,
  )
  // filter before the empty check, so a filter that matches nothing says so
  // rather than rendering a blank region under the heading
  const shown = externalPlugins.filter(p => matches(p.name))
  const kept = unloadedPermanentPlugins(session).filter(entry =>
    matches(pluginLabel(entry)),
  )

  return (
    <>
      <List>
        {shown.length > 0
          ? shown.map(p => {
              // match the store entry by the v2 identity (packageName embedded in
              // the version-pinned install url), not by display name: a plugin's
              // runtime name is its Plugin class name (e.g. "GWASPlugin") while
              // the store name is the UMD global (e.g. "GWAS"), so a name compare
              // misses for almost every plugin and no update is ever offered.
              const installedUrl = pluginManager.pluginMetadata[p.name]?.url
              const storeEntry = storePlugins?.find(
                s =>
                  s.packageName !== undefined &&
                  installedVersionFromUrl(installedUrl, s.packageName) !==
                    undefined,
              )
              return (
                <InstalledPlugin
                  key={p.name}
                  plugin={p}
                  model={model}
                  storeEntry={storeEntry}
                />
              )
            })
          : kept.length === 0 && (
              <Typography>
                {externalPlugins.length > 0
                  ? 'No installed plugins match this filter.'
                  : 'No plugins currently installed'}
              </Typography>
            )}
      </List>
      {kept.length > 0 && isSessionWithPermanentPlugins(session) ? (
        <>
          <Typography variant="subtitle2">
            Kept for this browser, not loaded this visit
          </Typography>
          <List>
            {kept.map(entry => (
              <UnloadedPermanentPlugin
                key={pluginLabel(entry)}
                session={session}
                entry={entry}
              />
            ))}
          </List>
          <Typography variant="body2">
            Changes take effect the next time this JBrowse loads.
          </Typography>
        </>
      ) : null}
    </>
  )
})

export default InstalledPluginsList
