import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
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
 * An AddTrackWidget model wired to a session with the alignments and variants
 * plugins installed, enough for `guessAdapter`/`guessTrackType` to resolve real
 * track types in unit tests.
 */
export function makeModel() {
  const pluginManager = new PluginManager([
    new FakeViewPlugin(),
    new Alignments(),
    new Variants(),
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
