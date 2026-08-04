import PluginManager from '@jbrowse/core/PluginManager'

import { DrawerWidgetSessionMixin } from './DrawerWidgets.ts'

const pluginManager = new PluginManager([])
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
