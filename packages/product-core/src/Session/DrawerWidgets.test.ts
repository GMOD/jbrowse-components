import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from '@jbrowse/mobx-state-tree'

import { DrawerWidgetSessionMixin } from './DrawerWidgets.ts'

// The widget lifecycle below is about the drawer, not about any particular
// widget. `BaseFeatureWidget` is the only type a bare PluginManager registers
// and it runs an autorun wanting a track to resolve, which this file has no
// reason to stand up — so register the smallest widget that can exist. It is
// also the shape the custom-widgets guide teaches.
class TestWidgetPlugin extends Plugin {
  name = 'TestWidgetPlugin'

  install(pm: PluginManager) {
    pm.addWidgetType(
      () =>
        new WidgetType({
          name: 'TestWidget',
          heading: 'Test widget',
          configSchema: ConfigurationSchema('TestWidget', {}),
          stateModel: types.model('TestWidget', {
            id: ElementId,
            type: types.literal('TestWidget'),
          }),
          ReactComponent: () => null,
        }),
    )
  }
}

const pluginManager = new PluginManager([new TestWidgetPlugin()])
  .createPluggableElements()
  .configure()

function createSession() {
  return DrawerWidgetSessionMixin(pluginManager).create({}, { pluginManager })
}

function setWindowWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    value: width,
    configurable: true,
    writable: true,
  })
}

const originalWidth = window.innerWidth
afterEach(() => {
  setWindowWidth(originalWidth)
})

// A pointer drag delta is fractional on a zoomed/HiDPI display (ResizeHandle
// derives it from `event.clientX`, a double), and drawerWidth is a
// types.integer refinement — an unrounded assignment throws mid-drag.
test('resizeDrawer accepts a fractional drag delta', () => {
  setWindowWidth(1000)
  const session = createSession()
  session.resizeDrawer(10.5)
  expect(session.drawerWidth).toBe(374)
  expect(Number.isInteger(session.drawerWidth)).toBe(true)
})

test('updateDrawerWidth rounds a fractional width', () => {
  setWindowWidth(1000)
  const session = createSession()
  expect(session.updateDrawerWidth(400.4)).toBe(400)
})

test('drawer width is clamped to the window, minus room for the main area', () => {
  setWindowWidth(1000)
  const session = createSession()
  expect(session.updateDrawerWidth(5000)).toBe(850)
})

// A window narrower than minDrawerWidth + minMainWidth has no width that
// satisfies both bounds; the refinement's floor has to win, or every resize in
// that window throws.
test('drawer width holds its minimum in a window too narrow for both', () => {
  setWindowWidth(200)
  const session = createSession()
  expect(session.updateDrawerWidth(160)).toBe(128)
  session.resizeDrawer(-10)
  expect(session.drawerWidth).toBe(128)
})

test('resizeDrawer returns the width actually consumed', () => {
  setWindowWidth(1000)
  const session = createSession()
  // dragging left (negative distance) widens a right-hand drawer
  expect(session.resizeDrawer(-16)).toBe(-16)
  expect(session.drawerWidth).toBe(400)
})

// The widget half of the drawer, which the drawer-widgets guide documents as a
// lifecycle — open, minimize, restore, close — and which nothing exercised: the
// tests above are all width arithmetic.
function addTestWidget(session: ReturnType<typeof createSession>, id: string) {
  return session.addWidget('TestWidget', id)
}

test('showWidget makes a widget the visible one', () => {
  const session = createSession()
  const widget = addTestWidget(session, 'first')
  session.showWidget(widget)
  expect(session.visibleWidget?.id).toBe('first')
})

// `visibleWidget` is the last entry of activeWidgets, so re-showing one already
// open has to move it to the end rather than leave it where it was — clicking a
// second feature while its details are open must bring that widget forward.
test('showing a widget again brings it to the front', () => {
  const session = createSession()
  const first = addTestWidget(session, 'first')
  const second = addTestWidget(session, 'second')
  session.showWidget(first)
  session.showWidget(second)
  expect(session.visibleWidget?.id).toBe('second')
  session.showWidget(first)
  expect(session.visibleWidget?.id).toBe('first')
  expect(session.activeWidgets.size).toBe(2)
})

// The claim the guide makes about minimizing: a minimized drawer must not
// swallow the widget opened next. Without the reset in showWidget the widget is
// active and visible and the drawer stays collapsed, which reads as the click
// having done nothing.
test('showing a widget restores a minimized drawer', () => {
  const session = createSession()
  session.minimizeWidgetDrawer()
  expect(session.minimized).toBe(true)
  session.showWidget(addTestWidget(session, 'first'))
  expect(session.minimized).toBe(false)
})

test('minimizing and restoring the drawer leaves the widget open', () => {
  const session = createSession()
  session.showWidget(addTestWidget(session, 'first'))
  session.minimizeWidgetDrawer()
  expect(session.visibleWidget?.id).toBe('first')
  session.showWidgetDrawer()
  expect(session.minimized).toBe(false)
  expect(session.visibleWidget?.id).toBe('first')
})

test('hideWidget closes one widget and uncovers the one beneath it', () => {
  const session = createSession()
  const first = addTestWidget(session, 'first')
  const second = addTestWidget(session, 'second')
  session.showWidget(first)
  session.showWidget(second)
  session.hideWidget(second)
  expect(session.visibleWidget?.id).toBe('first')
  session.hideWidget(first)
  expect(session.visibleWidget).toBeUndefined()
})

// Popped out means the widget is in a modal with no drawer behind it, so the
// last close has to drop that too — otherwise the next widget opens straight
// into a modal the user never asked for.
test('closing the last widget clears the popped-out state', () => {
  const session = createSession()
  const widget = addTestWidget(session, 'first')
  session.showWidget(widget)
  session.popoutWidget()
  expect(session.poppedOut).toBe(true)
  session.hideWidget(widget)
  expect(session.poppedOut).toBe(false)
})
