import { getSession, parseLocString, when } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { AbstractViewModel } from '@jbrowse/core/util/types'

import { GridBookmarkModel } from './model'
import { NavigableViewModel } from './types'

export async function navToBookmark(
  locString: string,
  views: AbstractViewModel[],
  model: GridBookmarkModel,
) {
  const { selectedAssembly } = model
  const lgv = views.find(
    view =>
      view.type === 'LinearGenomeView' &&
      // @ts-ignore
      view.assemblyNames[0] === selectedAssembly,
  ) as NavigableViewModel

  if (lgv) {
    lgv.navToLocString(locString)
  } else {
    const session = getSession(model)
    const { assemblyManager } = session
    const assembly = await assemblyManager.waitForAssembly(selectedAssembly)
    if (assembly) {
      try {
        const loc = parseLocString(locString, refName =>
          session.assemblyManager.isValidRefName(refName, selectedAssembly),
        )
        const { refName } = loc
        const { regions } = assembly
        const canonicalRefName = assembly.getCanonicalRefName(refName)

        let newDisplayedRegion
        if (regions) {
          newDisplayedRegion = regions.find(
            region => region.refName === canonicalRefName,
          )
        }

        const view = session.addView('LinearGenomeView', {
          displayName: selectedAssembly,
        }) as LinearGenomeViewModel
        await when(() => view.initialized)

        view.setDisplayedRegions([
          JSON.parse(JSON.stringify(newDisplayedRegion)),
        ])
        view.navToLocString(locString)
      } catch (e) {
        session.notify(`${e}`, 'error')
      }
    }
  }
}
