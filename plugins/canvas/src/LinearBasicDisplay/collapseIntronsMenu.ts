import { lazy } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { getContainingTrack, getSession } from '@jbrowse/core/util'
import { isAlive } from '@jbrowse/mobx-state-tree'
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen'

import { getFeatureName } from '../RenderFeatureDataRPC/labelUtils.ts'
import { getTranscripts, hasIntrons } from './CollapseIntronsDialog/util.ts'
import { getView } from './baseModel.ts'
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
// 'mRNA', 'lnc_RNA', 'protein_coding_gene', 'transcript'. Gates the menu item on
// the clicked FEATURE (the display's `isGeneLike`) and the transcript scope on
// the clicked SUBFEATURE, so a mature-protein or repeat subpart hit doesn't
// offer to collapse itself.
export function isGeneLikeType(type: string | undefined) {
  const t = (type ?? '').toLowerCase()
  return t.includes('gene') || t.includes('rna') || t.includes('transcript')
}

// Structural rather than `Instance<typeof stateModelFactory>`: the factory calls
// this builder, so importing its inferred model type back here would be a
// circular type reference. Same idiom, and same reason, as
// `FeatureMenuSelf` in featureContextMenu.ts.
export interface CollapseIntronsSelf extends IStateTreeNode {
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
  const openDialog = async (subfeatureId?: string) => {
    const session = getSession(self)
    const fullFeature = await self.fetchFullFeature(
      featureId,
      displayedRegionIndex,
    )
    // isAlive guards against the display being closed while fetchFullFeature was
    // in flight; getView/getContainingTrack below would throw on a detached node.
    if (!fullFeature || !isAlive(self)) {
      return
    }
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
    const view = getView(self)
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
  }
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
