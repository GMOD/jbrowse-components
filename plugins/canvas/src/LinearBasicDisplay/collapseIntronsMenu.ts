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
import {
  getTranscripts,
  hasCollapsibleIntrons,
} from './CollapseIntronsDialog/util.ts'

import type { SubfeatureInfo } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { FeatureContextMenuInfo } from './featureContextMenu.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

const CollapseIntronsDialog = lazy(
  () => import('./CollapseIntronsDialog/CollapseIntronsDialog.tsx'),
)

// Anchored at the end for gene and RNA so 'intergenic_region' is not offered
// a collapse.
const GENE_LIKE_TYPE = /gene(_segment)?$|rna$|transcript/
export function isGeneLikeType(type: string | undefined) {
  return type !== undefined && GENE_LIKE_TYPE.test(type.toLowerCase())
}

/**
 * A gene holds its introns in the transcripts it stacks, so its own glyph
 * paints none and only the type answers for it. The other two intron-bearing
 * shapes have no type to answer with — a cDNA or EST alignment types itself
 * `match`, and a BED12 with no thick region misses the gene heuristic and
 * carries no type at all — so they are read off the glyph, which recorded
 * whether it painted an intron between the parts it drew.
 */
export function offersCollapseIntrons(info: FeatureContextMenuInfo) {
  return isGeneLikeType(info.item.type) || info.item.spliced === true
}

// Structural rather than the model's instance type: the factory calls this
// builder, so importing its type back here is a circular reference.
interface CollapseIntronsSelf extends IStateTreeNode {
  fetchFullFeature: (
    featureId: string,
    displayedRegionIndex: number,
  ) => Promise<Feature | undefined>
}

// One row and one dialog whatever the click resolved to: a gene glyph's
// transcript hit boxes cover its whole span, so a scope submenu here would only
// ask what the dialog's own Transcript dropdown asks next. The clicked
// transcript arrives preselected instead.
export function collapseIntronsMenuItem(
  self: CollapseIntronsSelf,
  info: FeatureContextMenuInfo,
  subfeatureInfos: readonly SubfeatureInfo[],
): MenuItem {
  const {
    item: { featureId, name: drawnFeatureName },
    subfeature,
    displayedRegionIndex,
  } = info
  // The track's `labels.name` expression as each isoform was drawn, so the
  // dropdown and the launched view name what the user sees on the glyph. Only
  // the record's own name is reachable from the fetched feature.
  const transcriptLabels = new Map<string, string>()
  for (const s of subfeatureInfos) {
    if (s.parentFeatureId === featureId && s.displayLabel !== undefined) {
      transcriptLabels.set(s.featureId, s.displayLabel)
    }
  }
  return {
    label: 'Collapse introns',
    icon: CloseFullscreenIcon,
    onClick: async () => {
      await withFeatureDetails(
        self,
        () => self.fetchFullFeature(featureId, displayedRegionIndex),
        fullFeature => {
          const session = getSession(self)
          const transcripts = getTranscripts(fullFeature)
          if (!hasCollapsibleIntrons(transcripts)) {
            session.notify('No introns found in this feature', 'info')
            return
          }
          const view = containingLgv(self)
          const assemblyName = view.assemblyNames[0]
          const assembly = assemblyName
            ? session.assemblyManager.get(assemblyName)
            : undefined
          if (!assembly) {
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
              // Solo matches the exact uniqueId and a gene-shaped feature draws
              // from its top-level id, so this stays the gene even when one
              // transcript is picked.
              featureId,
              initialTranscriptId: subfeature?.featureId,
              transcriptLabels,
              // Titled with the drawn name, the track's `labels.name`
              // expression, so the new view agrees with the glyph the user
              // clicked; the record's own name is only the floor.
              featureName:
                drawnFeatureName ?? getFeatureName(fullFeature) ?? 'feature',
              trackId: readConfObject(
                getContainingTrack(self).configuration,
                'trackId',
              ),
            },
          ])
        },
      )
    },
  }
}
