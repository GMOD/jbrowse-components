import { lazy } from 'react'

import { pushLaunchViewMenuItem } from '@jbrowse/core/ui'
import { getContainingTrack, getSession } from '@jbrowse/core/util'
import AccountTreeIcon from '@mui/icons-material/AccountTree'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { PluggableElementType } from '@jbrowse/core/pluggableElementTypes'
import type DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import type { MenuItem } from '@jbrowse/core/ui'
import type { DerivativeCandidate } from '@jbrowse/plugin-alignments'

const DerivativeVsRefDialog = lazy(() => import('./LinearDerivativeVsRef.tsx'))

function isDisplay(elt: { name: string }): elt is DisplayType {
  return elt.name === 'LinearAlignmentsDisplay'
}

/**
 * "Linear read vs ref" for a reconstruction rather than a single read. That one
 * answers "what does THIS read say", from a read the user picked; this one
 * answers "which path do several reads agree on", from a grouping the display
 * computes. Both end in the same synteny view, so the pair reads as one idea at
 * two scales — the candidate for triage, then right-click a supporting read for
 * the single-molecule evidence behind it.
 *
 * A track-menu item, not a context-menu one: it is a statement about the read
 * set in view, so there is no read to right-click on.
 */
export default function LinearDerivativeVsRefMenuItemF(pm: PluginManager) {
  pm.addToExtensionPoint(
    'Core-extendPluggableElement',
    (pluggableElement: PluggableElementType) => {
      if (!isDisplay(pluggableElement)) {
        return pluggableElement
      }
      pluggableElement.stateModel = pluggableElement.stateModel.extend(self => {
        const superTrackMenuItems = self.trackMenuItems
        return {
          views: {
            trackMenuItems() {
              const items = superTrackMenuItems() as MenuItem[]
              pushLaunchViewMenuItem(items, {
                label: 'Reconstruct derivative allele...',
                icon: AccountTreeIcon,
                // Always offered, never disabled: whether any path has support
                // is what the dialog is for, and an item that greys out at a
                // locus with no split reads reads as broken rather than as an
                // answer. The empty case explains itself there.
                onClick: () => {
                  getSession(self).queueDialog(handleClose => [
                    DerivativeVsRefDialog,
                    {
                      model: self as {
                        derivativePathCandidates: DerivativeCandidate[]
                        hasReadsForDerivativePaths: boolean
                      },
                      track: getContainingTrack(self),
                      handleClose,
                    },
                  ])
                },
              })
              return items
            },
          },
        }
      })
      return pluggableElement
    },
  )
}
