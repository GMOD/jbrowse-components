import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema, setConf } from '@jbrowse/core/configuration'
import { detach, types } from '@jbrowse/mobx-state-tree'

import stateModelFactory from './model.ts'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()

const TrackSchema = ConfigurationSchema(
  'TestTrack',
  { color: { type: 'string', defaultValue: 'red' } },
  { explicitIdentifier: 'trackId' },
)

function setup() {
  const updateTrackConfiguration = jest.fn()
  const Session = types
    .model({ widgets: types.map(stateModelFactory(pluginManager)) })
    .volatile(() => ({ rpcManager: {}, configuration: {} }))
    .actions(() => ({
      updateTrackConfiguration,
      close(widget: IAnyStateTreeNode) {
        detach(widget)
      },
    }))
  const session = Session.create(
    {
      widgets: { editor: { id: 'editor', type: 'ConfigurationEditorWidget' } },
    },
    { pluginManager },
  )
  const editor = session.widgets.get('editor')!
  const target = TrackSchema.create({ trackId: 't1' }, { pluginManager })
  editor.setTarget(target)
  return { session, editor, target, updateTrackConfiguration }
}

afterEach(() => {
  jest.useRealTimers()
})

test('an edit saves after the debounce', () => {
  jest.useFakeTimers()
  const { target, updateTrackConfiguration } = setup()
  setConf(target, 'color', 'blue')
  jest.advanceTimersByTime(400)
  expect(updateTrackConfiguration).toHaveBeenLastCalledWith(
    expect.objectContaining({ trackId: 't1', color: 'blue' }),
  )
})

// closing a widget detaches it (#3538), and the destroy that follows clears the
// debounce timer
test('closing the editor saves an edit still inside the debounce', () => {
  jest.useFakeTimers()
  const { session, editor, target, updateTrackConfiguration } = setup()
  setConf(target, 'color', 'blue')
  session.close(editor)
  expect(updateTrackConfiguration).toHaveBeenLastCalledWith(
    expect.objectContaining({ trackId: 't1', color: 'blue' }),
  )
  const calls = updateTrackConfiguration.mock.calls.length
  jest.advanceTimersByTime(400)
  expect(updateTrackConfiguration).toHaveBeenCalledTimes(calls)
})
