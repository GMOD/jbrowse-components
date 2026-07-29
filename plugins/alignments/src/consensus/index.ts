import { lazy } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { launchTargetsMenuItem } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import NotesIcon from '@mui/icons-material/Notes'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type {
  PluggableElementType,
  ViewType,
} from '@jbrowse/core/pluggableElementTypes'
import type { LinearGenomeViewStateModel } from '@jbrowse/plugin-linear-genome-view'

// plugin install() runs at startup, so a static import would put the dialog
// (and the MUI Slider it uses) in the first-paint bundle
const ConsensusSequenceDialog = lazy(
  () => import('./ConsensusSequenceDialog.tsx'),
)

// "Get" is dropped along with the flat placement: under the rubberband menu's
// "Launch" group the verb is already there.
const CONSENSUS_LABEL = 'Consensus sequence'

interface DisplayLike {
  type: string
  adapterConfig: Record<string, unknown>
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
  pluginManager.addToExtensionPoint(
    'Core-extendPluggableElement',
    (pluggableElement: PluggableElementType) => {
      if (pluggableElement.name === 'LinearGenomeView') {
        const viewType = pluggableElement as ViewType
        const lgv = viewType.stateModel as LinearGenomeViewStateModel
        viewType.stateModel = lgv.views(self => {
          const superLaunchMenuItems = self.rubberBandLaunchMenuItems
          return {
            rubberBandLaunchMenuItems() {
              return [
                ...superLaunchMenuItems(),
                ...launchTargetsMenuItem({
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
                        getSession(self).queueDialog(handleClose => [
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
              ]
            },
          }
        })
      }
      return pluggableElement
    },
  )
}
