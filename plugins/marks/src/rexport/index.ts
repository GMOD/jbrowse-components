import { addViewMenuItems } from '@jbrowse/core/pluggableElementTypes'
import { getSession } from '@jbrowse/core/util'
import CodeIcon from '@mui/icons-material/Code'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

async function downloadRScript(view: LinearGenomeViewModel) {
  const session = getSession(view)
  try {
    const [{ exportLinearViewToR }, { saveAs }] = await Promise.all([
      import('./exportLinearView.ts'),
      import('@jbrowse/core/util/FileSaver'),
    ])
    const { script, notes } = await exportLinearViewToR(view)
    if (!script) {
      session.notify(
        `No open track has an R export. ${notes.join('; ')}`,
        'warning',
      )
      return
    }
    saveAs(
      new Blob([script], { type: 'text/plain;charset=utf-8' }),
      'jbrowse_view.R',
    )
    if (notes.length) {
      session.notify(
        `Exported with ${notes.length} note${notes.length === 1 ? '' : 's'} in the script header`,
        'info',
      )
    }
  } catch (e) {
    session.notifyError(`${e}`, e)
  }
}

export default function RExportF(pluginManager: PluginManager) {
  addViewMenuItems(pluginManager, 'LinearGenomeView', {
    menu: 'menuItems',
    items: self => ({
      label: 'Export R script',
      icon: CodeIcon,
      onClick: () => {
        downloadRScript(self).catch((e: unknown) => {
          console.error(e)
        })
      },
    }),
  })
}
