import {
  dropVendoredPlugins,
  pluginDescriptionString,
  pluginUrl,
} from '@jbrowse/core/PluginLoader'

import type { PluginDefinition } from '@jbrowse/core/PluginLoader'

export class UntrustedPluginsError extends Error {
  constructor() {
    super('Cancelled: the plugins this link loads were not trusted')
    this.name = 'UntrustedPluginsError'
  }
}

export interface AssertPluginsTrustedDeps {
  // resolves true when the plugins are known-good and need no prompt
  checkPlugins: (plugins: PluginDefinition[]) => Promise<boolean>
  // asks the user to vouch for them; resolves true if they accept
  confirm: (plugins: { description: string; url: string }[]) => Promise<boolean>
}

/**
 * Throws unless every plugin in a config that arrived from outside this machine
 * is either in the plugin store or vouched for by the user.
 *
 * A jbrowse:// link can be handed to us by any web page, and the config it
 * names can declare plugins whose javascript we then require() into a renderer
 * that has full Node access — so, unlike a config the user opened from their own
 * disk, this one is not trusted by virtue of having been loaded. jbrowse-web
 * gates the same case (SessionLoader's sessionTriaged/PluginWarningDialog); this
 * is the Desktop equivalent, sharing web's checkPlugins via @jbrowse/core.
 *
 * Both steps are injected so the flow is testable without Electron.
 */
export async function assertPluginsTrusted(
  plugins: PluginDefinition[] | undefined,
  { checkPlugins, confirm }: AssertPluginsTrustedDeps,
) {
  // vendored plugins are dropped before PluginLoader ever sees them, so they
  // must not trip the prompt either — jbrowse.org demo configs still list some
  const untrusted = dropVendoredPlugins(plugins ?? [])
  if (untrusted.length > 0 && !(await checkPlugins(untrusted))) {
    const accepted = await confirm(
      untrusted.map(p => ({
        description: pluginDescriptionString(p),
        url: pluginUrl(p),
      })),
    )
    if (!accepted) {
      throw new UntrustedPluginsError()
    }
  }
}
