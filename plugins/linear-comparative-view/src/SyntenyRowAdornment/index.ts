import { addTrackRowAdornment } from '@jbrowse/core/ui/trackRowAdornment'
import { syntenyRowAdornment } from '@jbrowse/synteny-core'
import CompareArrowsIcon from '@mui/icons-material/CompareArrows'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * Says, on a synteny track's row in the hierarchical track selector, what it
 * compares the view's assembly against.
 *
 * This plugin registers SyntenyTrack and LGVSyntenyDisplay, which is why
 * synteny tracks appear in an ordinary view's track list at all — so it is also
 * what explains them there. A row otherwise shows a name and nothing else, and
 * the name is whatever the config author chose.
 *
 * The selector can't work this out for itself: it is the data-management
 * plugin, and it has no business knowing what a PAF is. So it asks, and this
 * answers. The label itself is built in synteny-core, which owns the adapter
 * classification the answer turns on; only the glyph and the registration are
 * here, because this plugin's index already carries React and
 * comparative-adapters' deliberately does not (ADR-043).
 */
export default function SyntenyRowAdornmentF(pluginManager: PluginManager) {
  addTrackRowAdornment(
    pluginManager,
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
