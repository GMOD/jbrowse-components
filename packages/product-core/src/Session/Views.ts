import { addDisposer, getParent, getSnapshot, types } from 'mobx-state-tree'

import PluginManager from '@jbrowse/core/PluginManager'
import { AnyConfigurationModel, getConf, readConfObject } from '@jbrowse/core/configuration'
import type { BaseSessionModel } from '../../../../products/jbrowse-desktop/src/sessionModel/Base'
import { autorun } from 'mobx'
import { Region } from '@jbrowse/core/util'

export default function Views(pluginManager: PluginManager) {
  return types
    .model({
      /**
       * #property
       */
      views: types.array(pluginManager.pluggableMstType('view', 'stateModel')),
    })
    .actions(self => ({
      /**
       * #action
       */
      moveViewUp(id: string) {
        const idx = self.views.findIndex(v => v.id === id)

        if (idx === -1) {
          return
        }
        if (idx > 0) {
          self.views.splice(idx - 1, 2, self.views[idx], self.views[idx - 1])
        }
      },
      /**
       * #action
       */
      moveViewDown(id: string) {
        const idx = self.views.findIndex(v => v.id === id)

        if (idx === -1) {
          return
        }

        if (idx < self.views.length - 1) {
          self.views.splice(idx, 2, self.views[idx + 1], self.views[idx])
        }
      },

      /**
       * #action
       */
      addView(typeName: string, initialState = {}) {
        const typeDefinition = pluginManager.getElementType('view', typeName)
        if (!typeDefinition) {
          throw new Error(`unknown view type ${typeName}`)
        }

        const length = self.views.push({
          ...initialState,
          type: typeName,
        })
        return self.views[length - 1]
      },

      /**
       * #action
       */
      removeView(view: any) {
        for (const [, widget] of self.activeWidgets) {
          if (widget.view && widget.view.id === view.id) {
            self.hideWidget(widget)
          }
        }
        self.views.remove(view)
      },

      /**
       * #action
       */
      addLinearGenomeViewOfAssembly(assemblyName: string, initialState = {}) {
        return this.addViewOfAssembly(
          'LinearGenomeView',
          assemblyName,
          initialState,
        )
      },

      /**
       * #action
       */
      addViewOfAssembly(
        viewType: any,
        assemblyName: string,
        initialState: any = {},
      ) {
        const asm = self.assemblies.find(
          s => readConfObject(s, 'name') === assemblyName,
        )
        if (!asm) {
          throw new Error(
            `Could not add view of assembly "${assemblyName}", assembly name not found`,
          )
        }
        return this.addView(viewType, {
          ...initialState,
          displayRegionsFromAssemblyName: readConfObject(asm, 'name'),
        })
      },

      /**
       * #action
       */
      addViewFromAnotherView(
        viewType: string,
        otherView: any,
        initialState: { displayedRegions?: Region[] } = {},
      ) {
        const state = { ...initialState }
        state.displayedRegions = getSnapshot(otherView.displayedRegions)
        return this.addView(viewType, state)
      },
    }))
}
