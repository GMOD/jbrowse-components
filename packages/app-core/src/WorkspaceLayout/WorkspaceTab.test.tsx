import { types } from '@jbrowse/mobx-state-tree'
import { fireEvent, render, screen } from '@testing-library/react'
import { observer } from 'mobx-react'

import { LayoutRenderer } from './LayoutRenderer.tsx'
import { WorkspaceTab, tabDisplayName } from './WorkspaceTab.tsx'
import { WorkspaceLayoutMixin } from './model.ts'

import type { WorkspaceSessionType } from '../ui/App/types.ts'
import type { WorkspaceLayout } from './model.ts'
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

// `title === undefined` is the sentinel for "not renamed", `renameTab` accepts
// it, and until now no UI passed it: clearing the box discarded the edit
// instead, so a rename could be made and never unmade.
describe('renaming', () => {
  function renderTab(title?: string) {
    const renamed: (string | undefined)[] = []
    const layout = {
      renameTab: (_id: string, next: string | undefined) => {
        renamed.push(next)
      },
    } as unknown as WorkspaceLayout
    render(
      <WorkspaceTab
        tab={tab(title)}
        views={[view({ displayName: 'Derived' })]}
        session={session}
        layout={layout}
        onClose={() => {}}
      />,
    )
    fireEvent.doubleClick(screen.getByText(title ?? 'Derived'))
    return { renamed, input: screen.getByRole('textbox') }
  }

  test('a name typed in is kept', () => {
    const { renamed, input } = renderTab()
    fireEvent.change(input, { target: { value: '  Comparison  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(renamed).toEqual(['Comparison'])
  })

  test('clearing the box goes back to the automatic name', () => {
    const { renamed, input } = renderTab('Mine')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(renamed).toEqual([undefined])
  })

  test('Escape abandons the edit without renaming', () => {
    const { renamed, input } = renderTab('Mine')
    fireEvent.change(input, { target: { value: 'Something else' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(renamed).toEqual([])
  })
})

// The box is not a component on its own: it renders INSIDE the `role="tab"`
// that carries the strip's roving tabindex, and every key that handler takes —
// the arrows, Home, End, Enter, Space — it also preventDefault()s. All of them
// reach it by bubbling out of the box, so this has to be rendered in a real
// strip to be about anything. Isolated, the tests above pass either way.
describe('renaming inside the tab strip', () => {
  const TestSession = types.compose(
    'TestSession',
    types.model({ name: types.string }),
    WorkspaceLayoutMixin(),
  )

  const Harness = observer(function Harness({
    session,
  }: {
    session: ReturnType<typeof TestSession.create>
  }) {
    return (
      <LayoutRenderer
        node={session.tree}
        layout={session}
        chrome={{
          dragHandlers: {
            onTabPointerDown: () => {},
            onTabPointerMove: () => {},
            onTabPointerUp: () => {},
          },
          renderTabLabel: t => (
            <WorkspaceTab
              tab={t}
              views={[]}
              session={session as unknown as WorkspaceSessionType}
              layout={session}
              onClose={() => {}}
            />
          ),
          renderTabContent: () => null,
        }}
      />
    )
  })

  function openTheBox() {
    const session = TestSession.create({ name: 't' })
    render(<Harness session={session} />)
    fireEvent.doubleClick(screen.getByText('Empty'))
    return { session, input: screen.getByRole('textbox') }
  }

  // `fireEvent` returns false when a handler called preventDefault, which is
  // what decides whether the character is inserted at all
  test('a space reaches the box, so a tab name can have one in it', () => {
    const { input } = openTheBox()
    expect(fireEvent.keyDown(input, { key: ' ' })).toBe(true)
  })

  test('the arrows move the caret rather than jumping to the next tab', () => {
    const { input } = openTheBox()
    expect(fireEvent.keyDown(input, { key: 'ArrowLeft' })).toBe(true)
    expect(fireEvent.keyDown(input, { key: 'ArrowRight' })).toBe(true)
    expect(document.activeElement).toBe(input)
  })

  test('Home and End reach the box too', () => {
    const { input } = openTheBox()
    expect(fireEvent.keyDown(input, { key: 'Home' })).toBe(true)
    expect(fireEvent.keyDown(input, { key: 'End' })).toBe(true)
    expect(document.activeElement).toBe(input)
  })

  test('Enter still commits the name', () => {
    const { session, input } = openTheBox()
    fireEvent.change(input, { target: { value: 'My comparison' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(session.tabs[0]!.title).toBe('My comparison')
  })
})
