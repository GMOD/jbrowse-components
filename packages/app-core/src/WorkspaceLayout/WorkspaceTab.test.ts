import { tabDisplayName } from './WorkspaceTab.tsx'

import type { WorkspaceSessionType } from '../ui/App/types.ts'
import type { AbstractViewModel } from '@jbrowse/core/util'

const session = {
  assemblyManager: { getDisplayName: (n: string) => `${n}!` },
} as unknown as WorkspaceSessionType

const view = (v: Partial<AbstractViewModel>) => v as AbstractViewModel
const tab = (title?: string) => ({ id: 't', viewIds: [], title })

// A tab's name is derived from its views unless the user set one, and
// `title === undefined` is the sentinel for "not renamed". That is a plain
// `maybe` here. The dockview version had to compare the title against the panel
// id, because dockview restores an unset title AS the panel id — a comparison
// that misfires the moment someone names a tab after one.
test('a user-set title always wins', () => {
  expect(tabDisplayName(tab('Mine'), [], session)).toBe('Mine')
  expect(
    tabDisplayName(tab('Mine'), [view({ displayName: 'Other' })], session),
  ).toBe('Mine')
})

test('an empty tab says so — it is the view launcher', () => {
  expect(tabDisplayName(tab(), [], session)).toBe('Empty')
})

test('one view uses its display name, then its assemblies, then a fallback', () => {
  expect(
    tabDisplayName(tab(), [view({ displayName: 'My view' })], session),
  ).toBe('My view')
  expect(
    tabDisplayName(tab(), [view({ assemblyNames: ['hg19', 'hg38'] })], session),
  ).toBe('hg19!,hg38!')
  expect(tabDisplayName(tab(), [view({})], session)).toBe('View')
})

test('several views are counted', () => {
  expect(tabDisplayName(tab(), [view({}), view({}), view({})], session)).toBe(
    '3 views',
  )
})

// an empty string is not a name, and must fall through rather than render blank
test('an empty display name falls through', () => {
  expect(
    tabDisplayName(
      tab(),
      [view({ displayName: '', assemblyNames: ['hg19'] })],
      session,
    ),
  ).toBe('hg19!')
})
