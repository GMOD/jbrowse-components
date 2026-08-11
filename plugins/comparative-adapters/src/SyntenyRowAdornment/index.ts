import CompareArrowsIcon from '@mui/icons-material/CompareArrows'

import { syntenyRowAdornment } from './syntenyRowAdornment.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * Says, on a synteny track's row in the hierarchical track selector, what it
 * compares the view's assembly against.
 *
 * A SyntenyTrack registers a display against LinearGenomeView, so synteny
 * tracks appear in an ordinary view's track list on purpose — but a row there
 * shows a name and nothing else, and the name is whatever the config author
 * chose. Which assembly a comparison track reaches is in the config, and the
 * one thing the selector can't work out for itself is what any of that means:
 * it is the data-management plugin, and it has no business knowing what a PAF
 * is. So it asks, and this answers.
 */
export default function SyntenyRowAdornmentF(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'TrackSelector-trackRowAdornment',
    (adornment, { conf, session, viewAssemblyNames }) => {
      const found = syntenyRowAdornment({
        conf,
        viewAssemblyNames,
        assemblyManager: session.assemblyManager,
      })
      return found ? { icon: CompareArrowsIcon, ...found } : adornment
    },
  )
}
