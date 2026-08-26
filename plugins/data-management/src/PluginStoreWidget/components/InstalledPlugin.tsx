import { lazy, useState } from 'react'

import { isPluginUrl } from '@jbrowse/core/pluginDefinitions'
import {
  getEnv,
  getPluginUpdate,
  getSession,
  installedVersionFromUrl,
} from '@jbrowse/core/util'
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
  pluginHome,
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

function LockedPluginIconButton({ title }: { title: string }) {
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
}

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
          ? 'Loaded on every visit to this JBrowse. Click to keep it in this session only'
          : 'Keep this plugin on every visit to this JBrowse, in this browser'
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
  storeEntry,
}: {
  plugin: BasePlugin
  model: PluginStoreModel
  storeEntry?: JBrowsePlugin
}) {
  const { classes } = useStyles()
  const { pluginManager } = getEnv(model)
  const session = getSession(model)
  // a global plugin (Desktop) is in every session's plugin list but in no
  // session's config, so removing it here would filter a list it isn't in and
  // then ask for a reload that brings it straight back
  const isGlobal = pluginManager.pluginMetadata[plugin.name]?.isGlobal
  // which list to edit, rather than whether this user is an admin: an admin
  // looking at a session that brought its own plugins has to edit that session,
  // not the config those plugins were never in (see pluginHome)
  const home = isGlobal ? undefined : pluginHome(plugin, session)

  // the install url is recorded in the plugin metadata at load time; the matching
  // runtime definition is the concrete, version-pinned thing we remove/replace
  const installedUrl = pluginManager.pluginMetadata[plugin.name]?.url
  const definition = pluginManager.runtimePluginDefinitions.find(d =>
    isPluginUrl(d, installedUrl),
  )
  // read the installed version from the store-minted, version-pinned url rather
  // than the plugin's self-declared version, which is optional and often unset
  const installedVersion = installedVersionFromUrl(
    installedUrl,
    storeEntry?.packageName,
  )
  const update = storeEntry
    ? getPluginUpdate(storeEntry, session.version, installedVersion)
    : undefined
  // the pinned url is authoritative about which build is loaded; the plugin's
  // self-declared version is the fallback for a custom or pre-versioning url
  const shownVersion = installedVersion ?? plugin.version

  // only the two lists a keep toggle can move a plugin between, and only where
  // the product has a permanent list at all — a config-installed plugin is the
  // admin's to move, and a definition with no name cannot go back into the
  // session list, which keys on it
  const keepable =
    definition &&
    hasPluginName(definition) &&
    canInstallPermanently(session) &&
    (home === 'session' || home === 'permanent')
      ? definition
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
