import Plugin from '@jbrowse/core/Plugin'
import {
  extendDisplayType,
  extendViewType,
} from '@jbrowse/core/pluggableElementTypes'
import { addExtensionElement } from '@jbrowse/core/ui'
import {
  getContainingTrack,
  getContainingView,
  getSession,
  isAbstractMenuManager,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import FactCheckIcon from '@mui/icons-material/FactCheck'

import {
  REVIEW_WIDGET_TYPE,
  withVariantReview,
} from './VariantReviewViewExtension/model.ts'
import VariantReviewWidgetF from './VariantReviewWidget/index.ts'
import { VariantReviewGetCandidates } from './candidates/VariantReviewGetCandidates.ts'
import configSchema from './configSchema.ts'
import CandidateColumnOverlay from './overlay/CandidateColumnOverlay.tsx'

import type { VariantReviewView } from './VariantReviewViewExtension/model.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { DisplayTypeName } from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui/menuItems'
import type { IAnyModelType, IStateTreeNode } from '@jbrowse/mobx-state-tree'

// The single- and multi-sample variant displays. Neither is in
// `DisplayTypeRegistry`, and naming their model types would import the variants
// plugin, which this one deliberately does not; the extension below reads only
// `trackMenuItems` and the containing track and view.
const VARIANT_DISPLAY_TYPES = [
  'LinearVariantDisplay',
  'LinearMultiSampleVariantDisplay',
] as const

function isReviewView(v: unknown): v is VariantReviewView {
  return typeof (v as Partial<VariantReviewView>).startReview === 'function'
}

export default class VariantReviewPlugin extends Plugin {
  name = 'VariantReviewPlugin'

  configurationSchema = configSchema

  install(pluginManager: PluginManager) {
    VariantReviewWidgetF(pluginManager)

    pluginManager.addRpcMethod(
      () => new VariantReviewGetCandidates(pluginManager),
    )

    // No member tags reach the docs from here (see GridBookmarkPlugin): the
    // extension's own module carries them.
    extendViewType(pluginManager, 'LinearGenomeView', stateModel =>
      withVariantReview(stateModel),
    )

    extendDisplayType(
      pluginManager,
      VARIANT_DISPLAY_TYPES as unknown as readonly DisplayTypeName[],
      (stateModel: IAnyModelType) =>
        stateModel.views(
          (self: IStateTreeNode & { trackMenuItems: () => MenuItem[] }) => {
            const superTrackMenuItems = self.trackMenuItems
            return {
              trackMenuItems(): MenuItem[] {
                const view = getContainingView(self)
                return isReviewView(view)
                  ? [
                      ...superTrackMenuItems(),
                      {
                        label: 'Review variants in this track',
                        icon: FactCheckIcon,
                        onClick: () => {
                          const track = getContainingTrack(self)
                          void view.startReview(track.configuration.trackId)
                        },
                      },
                    ]
                  : superTrackMenuItems()
              },
            }
          },
        ),
    )

    addExtensionElement(
      pluginManager,
      'LinearGenomeView-TracksContainerComponent',
      CandidateColumnOverlay,
    )
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToMenu('Tools', {
        label: 'Variant review',
        icon: FactCheckIcon,
        onClick: (session: unknown) => {
          if (!isSessionModelWithWidgets(session)) {
            return
          }
          const focused = session.views.find(
            v => v.id === session.focusedViewId,
          )
          const view = isReviewView(focused)
            ? focused
            : session.views.find(isReviewView)
          const widget = session.addWidget(
            REVIEW_WIDGET_TYPE,
            view ? `${REVIEW_WIDGET_TYPE}-${view.id}` : REVIEW_WIDGET_TYPE,
            { view: view?.id },
          )
          session.showWidget(widget)
          if (!view) {
            getSession(widget).notify(
              'Open a linear genome view with a variant track to start review',
              'info',
            )
          }
        },
      })
    }
  }
}
