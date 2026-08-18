import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import { getSession } from '@jbrowse/core/util'
import { ElementId } from '@jbrowse/core/util/types/mst'
import {
  addDisposer,
  isAlive,
  onSnapshot,
  types,
} from '@jbrowse/mobx-state-tree'
import { autorun, onReactionError } from 'mobx'

import { MultipleViewsSessionMixin } from './MultipleViews.ts'

// `views` is a pluggableMstType union, so a view can only be added for a type
// the plugin manager knows. Two flat ones, because replaceView's whole point is
// swapping one type for another.
function fakeView(name: string) {
  return types.model(name, {
    id: ElementId,
    type: types.literal(name),
    displayName: types.maybe(types.string),
  })
}

// Built once each, not per registration, because a `types.safeReference`
// resolves against the type REGISTERED with the plugin manager: a nested view
// built from a second `fakeView('X')` call is a different MST type under the
// same name, and the reference then fails to resolve for a reason that is not
// what is under test.
const fakeLinearView = fakeView('FakeLinearView')
const fakeSyntenyView = fakeView('FakeSyntenyView')

// A view that CONTAINS views — the shape breakpoint-split and comparative views
// have, and the one that decides how `takeOut` has to match widgets.
const fakeContainerView = types.model('FakeContainerView', {
  id: ElementId,
  type: types.literal('FakeContainerView'),
  views: types.array(fakeLinearView),
})

// A view that reaches OUTSIDE its own tree when it is taken out of a session,
// which is the shape both comparative views have — they give back the
// read-vs-ref assemblies they synthesized. The module-level sink is how the
// test observes a hook running inside an action it does not otherwise see.
let reachingViewSaw: string[] | undefined

function fakeReachingView() {
  return types
    .model('FakeReachingView', {
      id: ElementId,
      type: types.literal('FakeReachingView'),
      displayName: types.maybe(types.string),
    })
    .actions(self => ({
      beforeDetach() {
        reachingViewSaw?.push(getSession(self).name)
      },
    }))
}

class FakeViewsPlugin extends Plugin {
  name = 'FakeViewsPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(
      () =>
        new ViewType({
          name: 'FakeReachingView',
          stateModel: fakeReachingView(),
          ReactComponent: () => null,
        }),
    )
    for (const stateModel of [
      fakeLinearView,
      fakeSyntenyView,
      fakeContainerView,
    ]) {
      pluginManager.addViewType(
        () =>
          new ViewType({
            name: stateModel.name,
            stateModel,
            ReactComponent: () => null,
          }),
      )
    }
    // The shape every real view-scoped widget has: a `types.safeReference` to a
    // pluggable view (HierarchicalTrackSelectorWidget, AddTrackWidget,
    // PluginStoreWidget all declare exactly this). What a replaced view does to
    // that reference is the thing worth pinning down.
    //
    // The autorun is load-bearing, not decoration: a widget's model outlives
    // the drawer panel, so it is the model's own reactions -- BaseFeatureWidget
    // registers one that reads `track` -- that go on reading a reference the
    // view took with it, and they report to `onReactionError`, not to a caller.
    pluginManager.addWidgetType(
      () =>
        new WidgetType({
          name: 'FakeViewWidget',
          stateModel: types
            .model('FakeViewWidget', {
              id: ElementId,
              type: types.literal('FakeViewWidget'),
              view: types.safeReference(
                pluginManager.pluggableMstType('view', 'stateModel'),
              ),
            })
            .actions(self => ({
              afterCreate() {
                addDisposer(
                  self,
                  autorun(() => {
                    void self.view
                  }),
                )
              },
            })),
          configSchema: ConfigurationSchema('FakeViewWidget', {}),
          ReactComponent: () => null,
        }),
    )
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

// The hazard that decides whether a replace may reuse the replaced view's id.
//
// Every view-scoped widget holds the view as a `types.safeReference`, which
// resolves by IDENTIFIER, not by node. So the safety of a replace rests on the
// new view getting a fresh id: the old id leaves the tree, the reference has
// nothing to resolve to, and it reads as undefined — a dead reference, which is
// the failure a caller can see. Reuse the id and the same reference silently
// rebinds to a view of a different type (a track selector pointing at the
// synteny view that replaced the LGV it was opened for), which is a failure
// nothing can see. This test is what stops that being traded away later.
test('a widget referencing the replaced view is dropped, not rebound', () => {
  const session = sessionWithThreeViews()
  const replaced = session.views[1]!
  // read before the replace: the node is destroyed by it, and MST's liveliness
  // check warns on any read after that
  const replacedId = replaced.id
  const widget = session.addWidget('FakeViewWidget', 'w1', {
    view: replacedId,
  })!
  session.showWidget(widget)
  expect(widget.view).toBe(replaced)

  const created = session.replaceView(replaced, 'FakeSyntenyView')

  // the id is not reused, so there is nothing for the reference to resolve to
  expect(created.id).not.toBe(replacedId)
  expect(widget.view).toBeUndefined()
  expect(widget.view).not.toBe(created)
  // and the widget is taken off screen rather than left showing an empty panel
  expect(session.activeWidgets.has('w1')).toBe(false)
})

// A view can CONTAIN views, and a widget can hold the inner one:
// `openFeatureWidget` stores `getContainingView(node)`, and inside a
// breakpoint-split or synteny view that walk lands on the sub-view, never on
// the view in `session.views`. Matching widgets by `widget.view.id === view.id`
// missed exactly those, leaving the widget on screen over a tree that had just
// left the session.
//
// The detach is what makes it a throw rather than a blank panel: a detached
// node is ALIVE, so `safeReference`'s onInvalidated has not fired, but it is
// already out of the session's identifier cache — so reading the reference
// throws "Failed to resolve reference" until the destroy task lands, on a
// widget React is still rendering. ADR-069.
function sessionWithSubViewWidget() {
  const session = createSession()
  const container = session.addView('FakeContainerView', {
    views: [{ type: 'FakeLinearView' }],
  })
  const sub = container.views[0]!
  const widget = session.addWidget('FakeViewWidget', 'w1', { view: sub.id })!
  session.showWidget(widget)
  return { session, container, sub, widget }
}

test('a widget referencing a sub-view is taken out with the view holding it', () => {
  const { session, container, sub, widget } = sessionWithSubViewWidget()
  expect(widget.view).toBe(sub)

  session.removeView(container)

  expect(session.activeWidgets.has('w1')).toBe(false)
})

// Hiding the widget is not enough, and the sub-view is where that shows. MST
// invalidates a reference when its TARGET detaches, so the container's own
// `beforeDetach` empties a reference to the container and leaves one pointing
// at anything under it: that node is neither detached nor destroyed, it just
// leaves the session's identifier cache, and reading it THROWS where
// `safeReference` promises undefined. The panel is off screen by then, but the
// widget's model is still in `widgets` with its autoruns running, so the throw
// comes out of a reaction — reported to `onReactionError`, never to the caller.
// This is the console error `ReadVsRef` produced on "Replace current view",
// where the reference was a feature widget's `track`.
test('a reference into the view empties rather than dangling', () => {
  const errors: unknown[] = []
  const dispose = onReactionError(e => {
    errors.push(e)
  })
  const { session, container, widget } = sessionWithSubViewWidget()

  session.removeView(container)

  dispose()
  expect(errors).toEqual([])
  expect(widget.view).toBeUndefined()
})

// A widget the user closed keeps its references and its autoruns, so the match
// is over every widget rather than over the active ones.
test('a hidden widget referencing the view is emptied too', () => {
  const errors: unknown[] = []
  const dispose = onReactionError(e => {
    errors.push(e)
  })
  const { session, container, widget } = sessionWithSubViewWidget()
  session.hideWidget(widget)

  session.removeView(container)

  dispose()
  expect(errors).toEqual([])
  expect(widget.view).toBeUndefined()
})

// Where that throw actually landed, and why the bug reads as "close a view,
// then close another one, and it breaks". A widget the first removal left
// behind is still active, and `takeOut` reads the view of EVERY active widget
// to decide which to hide — so the second removal reads the dangling one,
// throws inside the action, and leaves its own view in the session. Hiding the
// widget at the first removal is what stops the cascade.
test('removing a second view still works after one held a sub-view widget', () => {
  const { session, container } = sessionWithSubViewWidget()
  const other = session.addView('FakeLinearView', {})

  session.removeView(container)
  session.removeView(other)

  expect(session.views).toHaveLength(0)
})

// `session.views` is the one ordering, so a workspace move is the same action
// as a classic one with the panel's members named as its scope. Two panels
// interleaved in `views` is the case that tells the two apart.
describe('scoped moves', () => {
  function interleaved() {
    const session = createSession()
    for (const displayName of ['a1', 'b1', 'a2', 'b2']) {
      session.addView('FakeLinearView', { displayName })
    }
    return session
  }
  const names = (session: ReturnType<typeof interleaved>) =>
    session.views.map(v => v.displayName)
  const panelA = (session: ReturnType<typeof interleaved>) => [
    session.views[0]!.id,
    session.views[2]!.id,
  ]

  test('moves past the previous view in scope, not the previous view', () => {
    const session = interleaved()
    // a2 up means up past a1; b1 sits between them and does not move aside
    session.moveViewUp(session.views[2]!.id, panelA(session))
    expect(names(session)).toEqual(['a2', 'b1', 'a1', 'b2'])
  })

  test('is a no-op at the edge of the scope', () => {
    const session = interleaved()
    // a1 is already the first of its panel, even though b1 and b2 follow it
    session.moveViewUp(session.views[0]!.id, panelA(session))
    expect(names(session)).toEqual(['a1', 'b1', 'a2', 'b2'])
  })

  test('an unscoped move is the whole stack, as the classic one always was', () => {
    const session = interleaved()
    session.moveViewUp(session.views[2]!.id)
    expect(names(session)).toEqual(['a1', 'a2', 'b1', 'b2'])
  })
})

// The payoff of one ordering: a replace lands in place under BOTH layout modes,
// because the panel reads its views out of `session.views` rather than keeping
// an order of its own.
test('a replaced view keeps its position among its panel-mates', () => {
  const session = createSession()
  for (const displayName of ['a1', 'b1', 'a2', 'b2']) {
    session.addView('FakeLinearView', { displayName })
  }
  const panelAIds = new Set([session.views[0]!.id, session.views[2]!.id])

  const created = session.replaceView(session.views[2], 'FakeSyntenyView')

  // still third overall, so still second of the two panel-A views
  expect(session.views[2]).toBe(created)
  const stillInPanelA = session.views.filter(
    v => panelAIds.has(v.id) || v === created,
  )
  expect(stillInPanelA.map(v => v.type)).toEqual([
    'FakeLinearView',
    'FakeSyntenyView',
  ])
})

// The replacement takes the slot, so it takes the focus. Consumers all compare
// focusedViewId against a view id, so leaving the dead id would not error - the
// focus ring would just quietly match nothing.
test('replaceView moves the focus onto the view it created', () => {
  const session = sessionWithThreeViews()
  const replaced = session.views[1]!
  session.setFocusedViewId(replaced.id)

  const created = session.replaceView(replaced, 'FakeSyntenyView')

  expect(session.focusedViewId).toBe(created.id)
})

test('replaceView leaves another view’s focus alone', () => {
  const session = sessionWithThreeViews()
  const focused = session.views[0]!.id
  session.setFocusedViewId(focused)

  session.replaceView(session.views[1], 'FakeSyntenyView')

  expect(session.focusedViewId).toBe(focused)
})

// **`beforeDetach` runs while the view can still reach the session**, which is
// the whole reason the hook exists. Removing a view detaches it rather than
// destroying it in place (ADR-069), and a detached view is a root: `getSession`
// walks parents, so from `beforeDestroy` on the scheduled task it throws
// `no session model found!` — out of MST's own teardown.
//
// Both comparative views need that reach. `LinearComparativeView` and
// `DotplotView` give back the read-vs-ref assemblies they synthesized, which
// nothing else owns and nothing else would remove
// (`buildDotplotReadVsRefSpec.ts` names the contract; `releaseTemporaryAssemblies`
// is the shared body and guards the other direction).
test('a view is still in the session when its beforeDetach runs', () => {
  const seen: string[] = []
  reachingViewSaw = seen
  const session = createSession()
  const view = session.addView('FakeReachingView', { displayName: 'reaches' })

  session.removeView(view)

  expect(seen).toEqual(['test'])
})

// Undo and redo are `applySnapshot` on the whole session (`TimeTraveller`),
// which reconciles by identifier and so destroys every view the target snapshot
// lacks — in place, inside the action, with the components still mounted over
// them. That is what `takeOut` exists to prevent, reached through a door it did
// not cover, so the apply asks for this first.
// `products/jbrowse-web/src/tests/undoTeardown.test.tsx` measures what it is
// worth with a display mounted over the view: 4 liveliness reads and a
// `getContainingView` throw without it, none with it.
test('takeOutViewsMissingFrom takes out only what the snapshot drops', () => {
  const seen: string[] = []
  reachingViewSaw = seen
  const session = createSession()
  const kept = session.addView('FakeLinearView', { displayName: 'kept' })
  const dropped = session.addView('FakeReachingView', {
    displayName: 'dropped',
  })

  session.takeOutViewsMissingFrom({ views: [{ id: kept.id, type: kept.type }] })

  expect(session.views.map(v => v.id)).toEqual([kept.id])
  // detached, NOT destroyed — React's final read has to find a live tree, and
  // the destroy is a task later
  expect(isAlive(dropped)).toBe(true)
  expect(seen).toEqual(['test'])
})

// Same id, different type is a destroy too: MST's `areSame` runs the type's
// `is()` before it compares identifiers, so identity here is the pair rather
// than the id alone. `replaceView` always generates a fresh id and never lands
// on this, but a snapshot that was imported or hand-edited can.
test('takeOutViewsMissingFrom counts a changed type as a different view', () => {
  const session = createSession()
  const view = session.addView('FakeLinearView', {})

  session.takeOutViewsMissingFrom({
    views: [{ id: view.id, type: 'FakeSyntenyView' }],
  })

  expect(session.views).toHaveLength(0)
})
