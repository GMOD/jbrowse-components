import { sessionLastUsed as webCore } from '@jbrowse/web-core'

import {
  sessionLastUsed as menus,
  type SessionMetadata as MenusShape,
} from '../../../../plugins/menus/src/SessionManager/components/util.ts'

import type { SessionMetadata as WebCoreShape } from '@jbrowse/web-core'

// `plugins/menus` restates web-core's `SessionMetadata` and `sessionLastUsed`
// because a plugin cannot depend on a product package. That is the right call,
// and it is also unpinnable from either side: the plugin can never import the
// original, so nothing in TypeScript relates the two and a drift compiles
// cleanly on both. jbrowse-web depends on both, so this is the one place that
// can say they agree — same role as text-indexing's parity test for core's
// indexable-adapter mirror.
//
// What drift costs: the reader is `savedSessionMetadata` off the session at
// runtime, so a renamed or dropped field does not throw, it reads `undefined`.
// For `updatedAt` that means `sessionLastUsed` silently returns `createdAt` —
// which is the exact failure its own docstring exists to prevent, a session
// edited all week sorting by the day it was opened.

// Exact structural equality, NOT mutual assignability. Assignability is the
// obvious spelling and it is too weak for precisely the field that matters:
// `updatedAt` is optional, and an optional property that is renamed or dropped
// leaves both shapes still assignable to each other, so the check passes while
// the two disagree. This holds only when the keys, their optionality and their
// types all match.
type Eq<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false

const _shapesAgree: Eq<MenusShape, WebCoreShape> = true
void _shapesAgree

const createdAt = new Date('2020-01-01T00:00:00Z')
const updatedAt = new Date('2026-08-13T00:00:00Z')

const base = {
  id: 'a',
  name: 'a',
  createdAt,
  configPath: '/tmp/a',
  favorite: false,
}

test('both copies of sessionLastUsed answer the same', () => {
  const withUpdate = { ...base, updatedAt }
  expect(menus(withUpdate)).toEqual(webCore(withUpdate))
  expect(menus(withUpdate)).toBe(updatedAt)

  // the pre-`updatedAt` rows still in users' IndexedDB
  expect(menus(base)).toEqual(webCore(base))
  expect(menus(base)).toBe(createdAt)
})
