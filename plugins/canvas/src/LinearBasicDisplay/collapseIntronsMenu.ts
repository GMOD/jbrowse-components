import { lazy } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getSession,
  withFeatureDetails,
} from '@jbrowse/core/util'
import { containingLgv } from '@jbrowse/plugin-linear-genome-view'
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen'

import { getFeatureName } from '../RenderFeatureDataRPC/labelUtils.ts'
import { getTranscripts, hasIntrons } from './CollapseIntronsDialog/util.ts'
import { findSubfeatureById } from './baseModelHelpers.ts'

import type { SubfeatureInfo } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { FeatureContextMenuInfo } from './featureContextMenu.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

const CollapseIntronsDialog = lazy(
  () => import('./CollapseIntronsDialog/CollapseIntronsDialog.tsx'),
)

// Loose type test, matched case-insensitively like isCDS/isExon: real GFFs carry
// 'mRNA', 'lnc_RNA', 'protein_coding_gene', 'transcript'. Anchored at the end
// for gene and RNA so 'intergenic_region' is not offered a collapse. Gates the
// menu item on the clicked FEATURE (see the display's contextMenuItems) and the
// transcript scope on the clicked SUBFEATURE, so a mature-protein or repeat
// subpart hit doesn't offer to collapse itself.
const GENE_LIKE_TYPE = /gene(_segment)?$|rna$|transcript/
export function isGeneLikeType(type: string | undefined) {
  return type !== undefined && GENE_LIKE_TYPE.test(type.toLowerCase())
}

// Structural rather than `Instance<typeof stateModelFactory>`: the factory calls
// this builder, so importing its inferred model type back here would be a
// circular type reference. Same idiom, and same reason, as
// `FeatureMenuSelf` in featureContextMenu.ts.
interface CollapseIntronsSelf extends IStateTreeNode {
  fetchFullFeature: (
    featureId: string,
    displayedRegionIndex: number,
  ) => Promise<Feature | undefined>
}

/**
 * The "Collapse introns" context-menu row, in whichever of its two shapes the
 * hit earns.
 *
 * A gene glyph's transcript hit boxes cover its whole span, so a right-click on
 * the glyph ALWAYS resolves to a transcript. Narrowing to it unconditionally
 * would therefore leave no way to ask for the union of the gene's transcripts,
 * so a transcript hit offers both scopes side by side (the same shape the
 * Highlight submenu uses) and anything else is the plain gene-scope action.
 *
 * The row's identity — label and icon — is written once and spread into both
 * shapes, so they can't drift into reading as two different menu entries.
 */
export function collapseIntronsMenuItem(
  self: CollapseIntronsSelf,
  info: FeatureContextMenuInfo,
): MenuItem {
  const {
    item: { featureId },
    subfeature,
    displayedRegionIndex,
  } = info
  // `subfeatureId` scopes the collapse to the isoform actually clicked; omitted,
  // the whole gene's transcripts are unioned.
  // `withFeatureDetails` owns the three ways the lookup itself can end — threw,
  // found nothing, display gone — so what remains here is the run of early
  // returns for the ways a feature that WAS found still can't be collapsed. Each
  // of those already said something; the lookup coming back empty was the one
  // that said nothing at all.
  const openDialog = async (subfeatureId?: string) =>
    withFeatureDetails(
      self,
      () => self.fetchFullFeature(featureId, displayedRegionIndex),
      fullFeature => {
        const session = getSession(self)
        const target =
          subfeatureId === undefined
            ? fullFeature
            : findSubfeatureById(fullFeature, subfeatureId)
        if (!target) {
          session.notify('Could not find the clicked transcript', 'warning')
          return
        }
        const transcripts = getTranscripts(target)
        if (!hasIntrons(transcripts)) {
          session.notify('No introns found in this feature', 'info')
          return
        }
        const view = containingLgv(self)
        const assemblyName = view.assemblyNames[0]
        const assembly = assemblyName
          ? session.assemblyManager.get(assemblyName)
          : undefined
        if (!assembly) {
          // silently doing nothing here reads as a broken menu item
          session.notify(
            "Could not resolve this view's assembly, which is needed to clamp the collapsed regions",
            'warning',
          )
          return
        }
        session.queueDialog(handleClose => [
          CollapseIntronsDialog,
          {
            view,
            transcripts,
            handleClose,
            assembly,
            // solo is an exact uniqueId match and a gene-shaped feature draws from
            // its top-level id, so this stays the gene even when a single transcript
            // was picked
            featureId,
            // names the resulting view; the scope that was chosen, not
            // transcripts[0], since the gene scope collapses the union of all its
            // transcripts
            featureName: getFeatureName(target) ?? 'feature',
            trackId: readConfObject(
              getContainingTrack(self).configuration,
              'trackId',
            ),
          },
        ])
      },
    )
  const row = { label: 'Collapse introns', icon: CloseFullscreenIcon }
  const transcriptHit: SubfeatureInfo | undefined =
    subfeature && isGeneLikeType(subfeature.type) ? subfeature : undefined
  return transcriptHit
    ? {
        ...row,
        subMenu: [
          {
            label: transcriptHit.displayLabel
              ? `This transcript (${transcriptHit.displayLabel})`
              : 'This transcript',
            onClick: async () => {
              await openDialog(transcriptHit.featureId)
            },
          },
          {
            label: 'All transcripts',
            onClick: async () => {
              await openDialog()
            },
          },
        ],
      }
    : {
        ...row,
        onClick: async () => {
          await openDialog()
        },
      }
}
