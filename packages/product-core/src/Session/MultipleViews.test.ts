import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { onSnapshot, types } from '@jbrowse/mobx-state-tree'

import { MultipleViewsSessionMixin } from './MultipleViews.ts'

// `views` is a pluggableMstType union, so a view can only be added for a type
// the plugin manager knows. Two of them, because replaceView's whole point is
// swapping one type for another.
function fakeView(name: string) {
  return types.model(name, {
    id: ElementId,
    type: types.literal(name),
    displayName: types.maybe(types.string),
  })
}

class FakeViewsPlugin extends Plugin {
  name = 'FakeViewsPlugin'

  install(pluginManager: PluginManager) {
    for (const name of ['FakeLinearView', 'FakeSyntenyView']) {
      pluginManager.addViewType(
        () =>
          new ViewType({
            name,
            stateModel: fakeView(name),
            ReactComponent: () => null,
          }),
      )
    }
  }
}

const pluginManager = new PluginManager([new FakeViewsPlugin()])
  .createPluggableElements()
  .configure()

function createSession() {
  // `name` comes from BaseSessionModel, which this composes
  return MultipleViewsSessionMixin(pluginManager).create(
    { name: 'test' },
    { pluginManager },
  )
}

function sessionWithThreeViews() {
  const session = createSession()
  session.addView('FakeLinearView', { displayName: 'first' })
  session.addView('FakeLinearView', { displayName: 'second' })
  session.addView('FakeLinearView', { displayName: 'third' })
  return session
}

// The point of the action over remove-then-add: the launched view lands where
// the reader was looking, not at the bottom of a session that may be scrolled
// well past it.
test('replaceView puts the new view in the slot the old one held', () => {
  const session = sessionWithThreeViews()
  const replaced = session.views[1]!

  const created = session.replaceView(replaced, 'FakeSyntenyView', {
    displayName: 'launched',
  })

  expect(session.views.map(v => v.type)).toEqual([
    'FakeLinearView',
    'FakeSyntenyView',
    'FakeLinearView',
  ])
  expect(session.views[1]).toBe(created)
  expect(session.views.map(v => v.displayName)).toEqual([
    'first',
    'launched',
    'third',
  ])
})

test('replaceView returns a live view, and the old one is gone', () => {
  const session = sessionWithThreeViews()
  const replacedId = session.views[0]!.id

  const created = session.replaceView(session.views[0], 'FakeSyntenyView')

  expect(session.views).toHaveLength(3)
  expect(session.views.some(v => v.id === replacedId)).toBe(false)
  expect(created.id).not.toBe(replacedId)
})

// A launch is a click on a menu the view owns, so the view is normally still in
// the session — but nothing serializes that, and dropping the launched view on
// the floor is a worse answer than appending it.
test('replacing a view that is no longer in the session appends', () => {
  const session = sessionWithThreeViews()
  const detached = session.views[2]!
  session.removeView(detached)

  session.replaceView(detached, 'FakeSyntenyView')

  expect(session.views.map(v => v.type)).toEqual([
    'FakeLinearView',
    'FakeLinearView',
    'FakeSyntenyView',
  ])
})

// Replacing destroys a view, so getting it back has to be one ctrl-Z rather
// than two (or, worse, a remove the redo stack has already been truncated past).
// The TimeTraveller pushes one undo state per snapshot, so what this asserts is
// that the swap is a single MST transaction: the splice and the removal are
// both inside the action, and MST emits the snapshot once, at its end.
test('replaceView is one undoable step', () => {
  const session = sessionWithThreeViews()
  const snapshots: unknown[] = []
  onSnapshot(session, snap => {
    snapshots.push(snap)
  })

  session.replaceView(session.views[1], 'FakeSyntenyView')

  expect(snapshots).toHaveLength(1)
})
