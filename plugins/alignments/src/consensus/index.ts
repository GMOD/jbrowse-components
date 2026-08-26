import { lazy } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import {
  addDisplayMenuItems,
  addViewMenuItems,
} from '@jbrowse/core/pluggableElementTypes'
import { LAUNCH_LABEL, launchTargetsMenuItem } from '@jbrowse/core/ui'
import {
  getContainingTrack,
  getContainingView,
  getDialogHost,
} from '@jbrowse/core/util'
import NotesIcon from '@mui/icons-material/Notes'

import type { ConsensusDisplay } from './ConsensusSequenceDialog.tsx'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// plugin install() runs at startup, so a static import would put the dialog
// (and the MUI Slider it uses) in the first-paint bundle
const ConsensusSequenceDialog = lazy(
  () => import('./ConsensusSequenceDialog.tsx'),
)

// "Get" is dropped along with the flat placement: under the rubberband menu's
// "Launch" group the verb is already there.
const CONSENSUS_LABEL = 'Consensus sequence'

// The track menu's copy names the region it starts from, the way the synteny
// launch's two entries do: the selection is what the rubberband entry has and
// this one does not. Spelled out rather than built off CONSENSUS_LABEL, because
// `check-menu-labels` reads the docs' menu paths back off the source.
const VISIBLE_LABEL = 'Consensus sequence (visible region)'

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

  // The same dialog from the track menu, where a reader who has not already
  // drawn a rubberband can find it: the entry above exists only inside a menu a
  // selection opens, so it is reachable only by someone who knows it is there.
  // The visible region seeds the dialog's own region field rather than fixing
  // the call — the field is editable, and a window over the size guard opens
  // saying so.
  addDisplayMenuItems(pluginManager, 'LinearAlignmentsDisplay', {
    menu: 'trackMenuItems',
    group: LAUNCH_LABEL,
    items: self => ({
      label: VISIBLE_LABEL,
      icon: NotesIcon,
      onClick: () => {
        const view = getContainingView(self) as LinearGenomeViewModel
        // The VIEW, as the rubberband entry passes: the dialog's "Open as
        // variant track" shows what it added in it, and a display has no
        // `showTrack` to show it with.
        getDialogHost(self).queueDialog(handleClose => [
          ConsensusSequenceDialog,
          {
            model: view,
            display: self,
            trackName: `${getConf(getContainingTrack(self), 'name')}`,
            regions: view.dynamicBlocks.contentBlocks,
            handleClose,
          },
        ])
      },
    }),
  })
}
