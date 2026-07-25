import { lazy } from 'react'

import { getConf } from '@jbrowse/core/configuration'
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

interface DisplayLike {
  type: string
  adapterConfig: Record<string, unknown>
}
interface TrackLike {
  configuration: AnyConfigurationModel
  displays: DisplayLike[]
}

function alignmentsDisplays(tracks: TrackLike[]) {
  const out: { track: TrackLike; display: DisplayLike }[] = []
  for (const track of tracks) {
    for (const display of track.displays) {
      if (display.type === 'LinearAlignmentsDisplay') {
        out.push({ track, display })
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
          const superRubberBandMenuItems = self.rubberBandMenuItems
          return {
            rubberBandMenuItems() {
              const displays = alignmentsDisplays(self.tracks)
              if (!displays.length) {
                return superRubberBandMenuItems()
              }
              const open = (display: DisplayLike) => {
                const regions = self.getSelectedRegions(
                  self.leftOffset,
                  self.rightOffset,
                )
                if (!regions.length) {
                  return
                }
                getSession(self).queueDialog(handleClose => [
                  ConsensusSequenceDialog,
                  {
                    model: self,
                    display,
                    regions,
                    handleClose: () => {
                      handleClose()
                      self.setOffsets()
                    },
                  },
                ])
              }
              const item =
                displays.length === 1
                  ? {
                      label: 'Get consensus sequence',
                      icon: NotesIcon,
                      onClick: () => {
                        open(displays[0]!.display)
                      },
                    }
                  : {
                      label: 'Get consensus sequence',
                      icon: NotesIcon,
                      subMenu: displays.map(({ track, display }) => ({
                        label: `${getConf(track, 'name')}`,
                        onClick: () => {
                          open(display)
                        },
                      })),
                    }
              return [...superRubberBandMenuItems(), item]
            },
          }
        })
      }
      return pluggableElement
    },
  )
}
