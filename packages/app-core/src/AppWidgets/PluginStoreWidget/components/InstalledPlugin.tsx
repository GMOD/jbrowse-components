import { lazy, useState } from 'react'

import { getPluginUpdate, getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import DeleteIcon from '@mui/icons-material/Delete'
import LockIcon from '@mui/icons-material/Lock'
import PushPinIcon from '@mui/icons-material/PushPin'
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined'
import UpgradeIcon from '@mui/icons-material/Upgrade'
import {
  Button,
  IconButton,
  ListItem,
  ToggleButton,
  Tooltip,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import {
  addPluginTo,
  canInstallPermanently,
  hasPluginName,
  installedPluginInfo,
  removePluginFrom,
  setPluginPermanent,
} from './util.ts'

import type { PluginStoreModel } from '../model.ts'
import type { PluginHome } from './util.ts'
import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'
import type { PluginUpdate } from '@jbrowse/core/util'
import type { BasePlugin, JBrowsePlugin } from '@jbrowse/core/util/types'

// lazies
const DeletePluginDialog = lazy(() => import('./DeletePluginDialog.tsx'))

const useStyles = makeStyles()(() => ({
  iconMargin: {
    marginRight: '0.5rem',
  },
  name: {
    marginRight: '0.5rem',
  },
}))

const LockedPluginIconButton = observer(function LockedPluginIconButton({
  title,
}: {
  title: string
}) {
  const { classes } = useStyles()
  return (
    <Tooltip className={classes.iconMargin} title={title}>
      <span>
        <IconButton disabled>
          <LockIcon />
        </IconButton>
      </span>
    </Tooltip>
  )
})

const UninstallPluginIconButton = observer(function UninstallPluginIconButton({
  plugin,
  model,
  definition,
  home,
}: {
  plugin: BasePlugin
  model: PluginStoreModel
  definition: PluginDefinition
  home: PluginHome
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  return (
    <Tooltip className={classes.iconMargin} title="Uninstall plugin">
      <IconButton
        data-testid={`removePlugin-${plugin.name}`}
        onClick={() => {
          session.queueDialog(onClose => [
            DeletePluginDialog,
            {
              plugin: plugin.name,
              onClose: (name?: string) => {
                if (name) {
                  removePluginFrom(session, home, definition)
                }
                onClose()
              },
            },
          ])
        }}
      >
        <DeleteIcon />
      </IconButton>
    </Tooltip>
  )
})

// "Keep this plugin here" — the whole permanent list, from the one place a user
// already looks at what they have installed. A toggle rather than a second
// install button on the store card, because the plugin is by then installed and
// the question left is how long it lasts; and it reads back, which a button
// cannot: filled pin = every visit, outline = this session only.
const KeepPluginToggle = observer(function KeepPluginToggle({
  model,
  definition,
  permanent,
}: {
  model: PluginStoreModel
  definition: PluginDefinition & { name: string }
  permanent: boolean
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  return (
    <Tooltip
      className={classes.iconMargin}
      title={
        permanent
          ? 'Loaded on every visit. Click to keep for this session only'
          : 'Keep on every visit, in this browser'
      }
    >
      <ToggleButton
        value="permanent"
        size="small"
        color="primary"
        selected={permanent}
        data-testid={`keepPlugin-${definition.name}`}
        onChange={() => {
          setPluginPermanent(session, definition, !permanent)
        }}
      >
        {permanent ? (
          <PushPinIcon fontSize="small" />
        ) : (
          <PushPinOutlinedIcon fontSize="small" />
        )}
      </ToggleButton>
    </Tooltip>
  )
})

const UpdatePluginButton = observer(function UpdatePluginButton({
  plugin,
  model,
  update,
  current,
  fromVersion,
  home,
}: {
  plugin: BasePlugin
  model: PluginStoreModel
  update: PluginUpdate
  current: PluginDefinition
  fromVersion?: string
  home: PluginHome
}) {
  const session = getSession(model)
  const [queued, setQueued] = useState(false)
  return (
    <Tooltip title={`Update from v${fromVersion} to v${update.pluginVersion}`}>
      <Button
        size="small"
        variant="outlined"
        startIcon={<UpgradeIcon />}
        disabled={queued}
        data-testid={`updatePlugin-${plugin.name}`}
        onClick={() => {
          // swap the version-pinned definition: remove the current url, add the
          // newer one, both in the list the plugin actually lives in. Both
          // actions flag pluginsUpdated, prompting a reload that loads the new
          // build. Install under the store's name (the UMD global, e.g. "GWAS")
          // — not the runtime class name (e.g. "GWASPlugin"), which would make
          // the UMD bundle fail to load.
          removePluginFrom(session, home, current)
          addPluginTo(session, home, {
            ...update.definition,
            name: update.name,
            ...(home === 'permanent' ? { storePlugin: update.name } : {}),
          })
          setQueued(true)
        }}
      >
        {queued ? 'Update queued' : `Update to v${update.pluginVersion}`}
      </Button>
    </Tooltip>
  )
})

const InstalledPlugin = observer(function InstalledPlugin({
  plugin,
  model,
  storePlugins,
}: {
  plugin: BasePlugin
  model: PluginStoreModel
  storePlugins?: JBrowsePlugin[]
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const { definition, storeEntry, installedVersion, isGlobal, home } =
    installedPluginInfo(plugin, session, storePlugins)
  const update = storeEntry
    ? getPluginUpdate(storeEntry, session.version, installedVersion)
    : undefined
  // the pinned url is authoritative about which build is loaded; the plugin's
  // self-declared version is the fallback for a custom or pre-versioning url
  const shownVersion = installedVersion ?? plugin.version

  // only the two lists a keep toggle can move a plugin between, and only where
  // the product has a permanent list at all — a config-installed plugin is the
  // admin's to move, and a definition with no name cannot go back into the
  // session list, which keys on it.
  //
  // A store plugin is kept as a store ref beside its pinned url. The permanent
  // list outlives the JBrowse it was written against, and the ref is what lets
  // the entry resolve against the store for whatever version is running next
  // time, rather than keep loading a build pinned to this one.
  const keepable =
    definition &&
    hasPluginName(definition) &&
    canInstallPermanently(session) &&
    (home === 'session' || home === 'permanent')
      ? storeEntry
        ? { ...definition, storePlugin: storeEntry.name }
        : definition
      : undefined

  return (
    <ListItem key={plugin.name}>
      {home && definition ? (
        <UninstallPluginIconButton
          plugin={plugin}
          model={model}
          definition={definition}
          home={home}
        />
      ) : (
        <LockedPluginIconButton
          title={
            isGlobal
              ? 'This plugin is installed globally, remove it from the start screen’s "Global plugins" dialog.'
              : 'This plugin was installed by an administrator, you cannot remove it.'
          }
        />
      )}
      {keepable ? (
        <KeepPluginToggle
          model={model}
          definition={keepable}
          permanent={home === 'permanent'}
        />
      ) : null}
      <Typography className={classes.name}>
        {/* prefer the store's display name (the UMD global, e.g. "GWAS") over
        the runtime Plugin class name (e.g. "GWASPlugin") so it matches the
        available-plugins list */}
        {storeEntry?.name ?? plugin.name}
        {shownVersion ? ` (v${shownVersion})` : ''}
      </Typography>
      {update && home && definition ? (
        <UpdatePluginButton
          plugin={plugin}
          model={model}
          update={update}
          current={definition}
          fromVersion={installedVersion}
          home={home}
        />
      ) : null}
    </ListItem>
  )
})

export default InstalledPlugin
