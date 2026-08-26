import { lazy } from 'react'

import { addDisplayMenuItems } from '@jbrowse/core/pluggableElementTypes'
import { LAUNCH_LABEL } from '@jbrowse/core/ui'
import { getContainingTrack, getDialogHost } from '@jbrowse/core/util'
import AccountTreeIcon from '@mui/icons-material/AccountTree'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type {
  DerivativeCandidate,
  DerivativePathEvidence,
} from '@jbrowse/plugin-alignments'

const DerivativeVsRefDialog = lazy(() => import('./LinearDerivativeVsRef.tsx'))

/** What the picker reads off the display it was opened from. */
export interface DerivativePathHost {
  derivativePathCandidates: DerivativeCandidate[]
  hasReadsForDerivativePaths: boolean
  derivativePathEvidence: DerivativePathEvidence
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
 *
 * Offered on the synteny display too: a de novo assembly contig aligned to the
 * reference is the same object as a split read at a larger scale, and
 * `LGVSyntenyDisplay` composes the alignments model that groups them.
 */
export default function LinearDerivativeVsRefMenuItemF(pm: PluginManager) {
  const items = (self: IStateTreeNode & DerivativePathHost) => ({
    label: 'Reconstruct derivative allele...',
    icon: AccountTreeIcon,
    // Always offered, never disabled: whether any path has support is what
    // the dialog is for, and an item that greys out at a locus with no split
    // reads reads as broken rather than as an answer. The empty case explains
    // itself there.
    onClick: () => {
      getDialogHost(self).queueDialog(handleClose => [
        DerivativeVsRefDialog,
        {
          model: self,
          track: getContainingTrack(self),
          handleClose,
        },
      ])
    },
  })
  addDisplayMenuItems(pm, ['LinearAlignmentsDisplay', 'LGVSyntenyDisplay'], {
    menu: 'trackMenuItems',
    group: LAUNCH_LABEL,
    items,
  })
}
