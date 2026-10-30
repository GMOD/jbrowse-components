import {
  desktopVendoredPluginNames,
  dropVendoredPlugins,
  pluginDescriptionString,
  pluginUrl,
  resolvedPluginUrl,
} from '@jbrowse/core/pluginDefinitions'

import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'

// where the plugin will actually load from, which a umdLoc's baseUri can make
// look nothing like its uri
const resolvedUrl = (p: PluginDefinition) =>
  resolvedPluginUrl(p) ?? pluginUrl(p)

export class UntrustedPluginsError extends Error {
  constructor() {
    super('Cancelled: the plugins this session loads were not trusted')
    this.name = 'UntrustedPluginsError'
  }
}

interface AssertPluginsTrustedDeps {
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
  const untrusted = dropVendoredPlugins(
    plugins ?? [],
    desktopVendoredPluginNames,
  )
  // A packaged Desktop loads a umdLoc/esmLoc that resolves to a local file,
  // for a config the user opened from disk. One from outside could aim that at
  // a file it planted, so it gets no prompt to misread: http(s) or nothing.
  const local = untrusted.filter(p => !/^https?:/.test(resolvedUrl(p)))
  if (local.length > 0) {
    throw new Error(
      `A config from outside this computer cannot load plugins from it: ${local.map(resolvedUrl).join(', ')}`,
    )
  }
  if (untrusted.length > 0 && !(await checkPlugins(untrusted))) {
    const accepted = await confirm(
      untrusted.map(p => ({
        description: pluginDescriptionString(p),
        url: resolvedUrl(p),
      })),
    )
    if (!accepted) {
      throw new UntrustedPluginsError()
    }
  }
}
