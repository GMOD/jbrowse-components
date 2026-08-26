import { isPluginUrl } from '@jbrowse/core/pluginDefinitions'
import {
  getEnv,
  isSessionWithPermanentPlugins,
  isSessionWithSessionPlugins,
} from '@jbrowse/core/util'

import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'
import type { AbstractSessionModel, BasePlugin } from '@jbrowse/core/util/types'

/**
 * Which plugin list a definition lives in: the jbrowse config's `plugins[]`, the
 * session's own `sessionPlugins[]`, or — where the product keeps one —
 * the browser's permanent list for this config.
 */
export type PluginHome = 'config' | 'session' | 'permanent'

// session.jbrowse is IAnyStateTreeNode, which resolves to `any` — name the
// members used here so a typo is a build error rather than a runtime no-op
function configPlugins(session: AbstractSessionModel) {
  return session.jbrowse as {
    // optional: the single-view embedded products' config model declares this
    // as a bare `types.frozen()`, which is undefined until something sets it
    plugins?: PluginDefinition[]
    addPlugin: (definition: PluginDefinition) => void
    removePlugin: (definition: PluginDefinition) => void
  }
}

/**
 * The url a loaded plugin was installed from, which is what every "is this
 * plugin in that list" question below compares against.
 */
function installedUrl(plugin: BasePlugin, session: AbstractSessionModel) {
  const { pluginManager } = getEnv(session)
  return pluginManager.pluginMetadata[plugin.name]?.url
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
 *
 * The lists are asked in the order the loader merges them, so the answer names
 * the list the *loaded* copy came from. A config's entry outranks a permanent
 * one naming the same plugin, because that is the one the loader kept — offering
 * to uninstall the shadowed permanent entry here would be a click that visibly
 * changes nothing (the config still carries it). The permanent plugins dialog
 * still shows that entry, which is where it can be taken out.
 *
 * `isPluginUrl`, because both sides of the comparison have a miss value: a core
 * plugin recorded no install url, and a definition naming no loader reads back
 * as the display string 'unknown url'. Neither may match anything.
 */
export function pluginHome(
  plugin: BasePlugin,
  session: AbstractSessionModel,
): PluginHome | undefined {
  const url = installedUrl(plugin, session)
  if (
    isSessionWithSessionPlugins(session) &&
    session.sessionPlugins.some(p => isPluginUrl(p, url))
  ) {
    return 'session'
  }
  if ((configPlugins(session).plugins ?? []).some(p => isPluginUrl(p, url))) {
    return session.adminMode ? 'config' : undefined
  }
  if (
    isSessionWithPermanentPlugins(session) &&
    session.permanentPlugins.some(p => isPluginUrl(p, url))
  ) {
    return 'permanent'
  }
  return session.adminMode ? 'config' : undefined
}

/**
 * Where a plugin the user is installing now should go. An install lands in the
 * session, or in the config for an admin; keeping it for good is the Installed
 * list's own toggle, on a plugin that has proved itself.
 */
export function newPluginHome(session: AbstractSessionModel): PluginHome {
  return session.adminMode ? 'config' : 'session'
}

/** Whether this product offers the permanent list at all (jbrowse-web does). */
export function canInstallPermanently(session: AbstractSessionModel) {
  return !session.adminMode && isSessionWithPermanentPlugins(session)
}

/**
 * Adds a definition to one of the lists. Returns false (having said so) when
 * the session has no list of the requested kind — an embedded product whose
 * session model includes neither mixin.
 */
export function addPluginTo(
  session: AbstractSessionModel,
  home: PluginHome,
  definition: PluginDefinition & { name: string },
) {
  if (home === 'config') {
    configPlugins(session).addPlugin(definition)
  } else if (home === 'permanent' && isSessionWithPermanentPlugins(session)) {
    session.addPermanentPlugin(definition)
  } else if (home === 'session' && isSessionWithSessionPlugins(session)) {
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
  } else if (home === 'permanent' && isSessionWithPermanentPlugins(session)) {
    session.removePermanentPlugin(definition)
  } else if (home === 'session' && isSessionWithSessionPlugins(session)) {
    session.removeSessionPlugin(definition)
  }
}

/** Narrows a definition to one the session list can hold, which keys on name. */
export function hasPluginName(
  definition: PluginDefinition,
): definition is PluginDefinition & { name: string } {
  return 'name' in definition && typeof definition.name === 'string'
}

/**
 * Moves an installed plugin between this session's list and the permanent one,
 * which is what the Installed list's keep toggle does.
 *
 * A move rather than a copy in both directions: two lists naming one plugin is
 * a duplicate `PluginManager.addPlugin` refuses by name on the next load, so
 * the copy would be dead weight that has to be uninstalled twice. Added before
 * removed, so a failure partway leaves the plugin installed somewhere.
 */
export function setPluginPermanent(
  session: AbstractSessionModel,
  definition: PluginDefinition & { name: string },
  permanent: boolean,
) {
  const [to, from] = permanent
    ? (['permanent', 'session'] as const)
    : (['session', 'permanent'] as const)
  if (addPluginTo(session, to, definition)) {
    removePluginFrom(session, from, definition)
  }
}
