import { lazy } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { addViewMenuItems } from '@jbrowse/core/pluggableElementTypes'
import { launchTargetsMenuItem } from '@jbrowse/core/ui'
import { getDialogHost } from '@jbrowse/core/util'
import NotesIcon from '@mui/icons-material/Notes'

import type { ConsensusDisplay } from './ConsensusSequenceDialog.tsx'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

// plugin install() runs at startup, so a static import would put the dialog
// (and the MUI Slider it uses) in the first-paint bundle
const ConsensusSequenceDialog = lazy(
  () => import('./ConsensusSequenceDialog.tsx'),
)

// "Get" is dropped along with the flat placement: under the rubberband menu's
// "Launch" group the verb is already there.
const CONSENSUS_LABEL = 'Consensus sequence'

// The dialog's own prop type plus the discriminator picking it out of a track's
// displays, so what the dialog reads off a display is checked here rather than
// re-declared and free to drift.
interface DisplayLike extends ConsensusDisplay {
  type: string
}
interface TrackLike {
  configuration: AnyConfigurationModel
  displays: DisplayLike[]
}

// Which track a consensus is called from changes the answer, so it is always
// named: launchTargetsMenuItem makes these the submenu under the entry, one
// open alignments track included.
function alignmentsDisplays(tracks: TrackLike[]) {
  const out: { name: string; display: DisplayLike }[] = []
  for (const track of tracks) {
    for (const display of track.displays) {
      if (display.type === 'LinearAlignmentsDisplay') {
        out.push({ name: `${getConf(track, 'name')}`, display })
      }
    }
  }
  return out
}

export default function ConsensusSequenceF(pluginManager: PluginManager) {
  // the view nests these under "Launch" itself, so no `group` here
  addViewMenuItems(pluginManager, 'LinearGenomeView', {
    menu: 'rubberBandLaunchMenuItems',
    items: self =>
      launchTargetsMenuItem({
        label: CONSENSUS_LABEL,
        icon: NotesIcon,
        entries: alignmentsDisplays(self.tracks),
        entryLabel: entry => entry.name,
        onSelect:
          ({ name, display }) =>
          () => {
            const regions = self.getSelectedRegions(
              self.leftOffset,
              self.rightOffset,
            )
            if (regions.length) {
              getDialogHost(self).queueDialog(handleClose => [
                ConsensusSequenceDialog,
                {
                  model: self,
                  display,
                  trackName: name,
                  regions,
                  handleClose: () => {
                    handleClose()
                    self.setOffsets()
                  },
                },
              ])
            }
          },
      }),
  })
}
