import { dialog } from 'electron'

import { ipcHandle } from './channels.ts'

// Wording mirrors jbrowse-web's PluginWarningDialog, with the stakes restated
// for Desktop: a plugin here is require()d into a nodeIntegration renderer, so
// it runs with the user's full privileges rather than inside a browser origin.
const DETAIL = `Configs can load arbitrary javascript via plugins, and on Desktop that javascript runs with full access to your computer and files.

You are seeing this because this link's config loads plugins that are not in the JBrowse plugin store. Only continue if you trust the source of the link.`

export function registerPluginHandlers() {
  ipcHandle('confirmUntrustedPlugins', async (_, plugins) => {
    const list = plugins.map(p => `  • ${p.description} — ${p.url}`).join('\n')
    const { response } = await dialog.showMessageBox({
      type: 'warning',
      title: 'Unrecognized plugins',
      message: 'This link wants to load plugins from outside the plugin store:',
      detail: `${list}\n\n${DETAIL}`,
      buttons: ['Cancel', 'Load plugins'],
      // Enter/Esc both decline: the safe choice must be the accidental one
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    })
    return response === 1
  })
}
