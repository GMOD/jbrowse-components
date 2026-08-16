import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import { addAddTrackComponent } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import Alignments from '@jbrowse/plugin-alignments'
import Variants from '@jbrowse/plugin-variants'

import addTrackModelFactory from '../AddTrackWidget/model.ts'

import type { FileLocation } from '@jbrowse/core/util/types'

const FakeViewModel = types.model('FakeView', {
  id: types.identifier,
  type: types.literal('FakeView'),
  assemblyNames: types.maybe(types.array(types.string)),
})

class FakeViewPlugin extends Plugin {
  name = 'FakeViewPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(
      () =>
        new ViewType({
          name: 'FakeView',
          stateModel: FakeViewModel,
          ReactComponent: () => <div>Hello world</div>,
        }),
    )
  }
}

/**
 * Claims `adapterTypes` for an add-track picker that supplies the assembly, the
 * way the synteny plugins do. Lets a test exercise "this format needs the
 * single-track form" against a format the alignments/variants plugins already
 * guess, rather than pulling a whole extra plugin in to get one real claim.
 */
export function fakeAddTrackComponentPlugin(adapterTypes: string[]) {
  return new (class extends Plugin {
    name = 'FakeAddTrackComponentPlugin'

    install(pluginManager: PluginManager) {
      addAddTrackComponent(pluginManager, {
        adapterTypes,
        component: () => null,
        ownsAssembly: true,
      })
    }
  })()
}

/**
 * An AddTrackWidget model wired to a session with the alignments and variants
 * plugins installed, enough for `guessAdapter`/`guessTrackType` to resolve real
 * track types in unit tests.
 */
export function makeModel(extraPlugins: Plugin[] = []) {
  const pluginManager = new PluginManager([
    new FakeViewPlugin(),
    new Alignments(),
    new Variants(),
    ...extraPlugins,
  ])
  pluginManager.createPluggableElements()
  pluginManager.configure()

  const SessionModel = types
    .model({
      view: FakeViewModel,
      widget: addTrackModelFactory(pluginManager),
    })
    .volatile(() => ({
      rpcManager: {},
      configuration: {},
    }))

  const session = SessionModel.create(
    {
      view: { id: 'v', type: 'FakeView', assemblyNames: ['volvox'] },
      widget: { type: 'AddTrackWidget', view: 'v' },
    },
    { pluginManager },
  )
  return session.widget
}

export function uri(s: string): FileLocation {
  return { uri: s, locationType: 'UriLocation' }
}
