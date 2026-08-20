import { isPluginUrl } from '@jbrowse/core/pluginDefinitions'
import { getEnv, isSessionWithSessionPlugins } from '@jbrowse/core/util'

import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'
import type { AbstractSessionModel, BasePlugin } from '@jbrowse/core/util/types'

/**
 * Which of the two plugin lists a definition lives in: the jbrowse config's
 * `plugins[]`, or the session's own `sessionPlugins[]`.
 */
export type PluginHome = 'config' | 'session'

// session.jbrowse is IAnyStateTreeNode, which resolves to `any` — name the two
// members used here so a typo is a build error rather than a runtime no-op
function configPlugins(session: AbstractSessionModel) {
  return session.jbrowse as {
    addPlugin: (definition: PluginDefinition) => void
    removePlugin: (definition: PluginDefinition) => void
  }
}

/**
 * Whether the loaded plugin came from the session's own list, matched on the
 * install url recorded in its metadata.
 *
 * `isPluginUrl`, because both sides of that comparison have a miss value: a core
 * or global plugin recorded no install url, and a definition naming no loader
 * reads back as the display string 'unknown url'. Neither may match anything.
 */
function isSessionPlugin(plugin: BasePlugin, session: AbstractSessionModel) {
  const { pluginManager } = getEnv(session)
  const installedUrl = pluginManager.pluginMetadata[plugin.name]?.url
  return isSessionWithSessionPlugins(session)
    ? session.sessionPlugins.some(p => isPluginUrl(p, installedUrl))
    : false
}

/**
 * Where an **already-installed** plugin's definition lives, or undefined when
 * this user cannot edit the list holding it.
 *
 * `adminMode` answers where a *new* install goes; it does not answer where an
 * existing one already is, and the two disagree whenever an admin opens a
 * shared or hub session that carries its own `sessionPlugins`. Editing the
 * config for one of those is silent both ways: `removePlugin` filters a list
 * the plugin was never in, so uninstalling removes nothing and still asks for a
 * whole-app reload, and an update appends a second copy under the same UMD name
 * — which `PluginManager.addPlugin` then refuses by name on the next load, so
 * the update does nothing while the admin's config.json keeps the duplicate.
 */
export function pluginHome(
  plugin: BasePlugin,
  session: AbstractSessionModel,
): PluginHome | undefined {
  return isSessionPlugin(plugin, session)
    ? 'session'
    : session.adminMode
      ? 'config'
      : undefined
}

/** Where a plugin the user is installing now should go. */
export function newPluginHome(session: AbstractSessionModel): PluginHome {
  return session.adminMode ? 'config' : 'session'
}

/**
 * Adds a definition to one of the two lists. Returns false (having said so)
 * when the session has no `sessionPlugins` to add to — an embedded product
 * whose session model does not include the mixin.
 */
export function addPluginTo(
  session: AbstractSessionModel,
  home: PluginHome,
  definition: PluginDefinition & { name: string },
) {
  if (home === 'config') {
    configPlugins(session).addPlugin(definition)
  } else if (isSessionWithSessionPlugins(session)) {
    session.addSessionPlugin(definition)
  } else {
    session.notify('No way to install plugin')
    return false
  }
  return true
}

export function removePluginFrom(
  session: AbstractSessionModel,
  home: PluginHome,
  definition: PluginDefinition,
) {
  if (home === 'config') {
    configPlugins(session).removePlugin(definition)
  } else if (isSessionWithSessionPlugins(session)) {
    session.removeSessionPlugin(definition)
  }
}
