import { types } from '@jbrowse/mobx-state-tree'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { observer } from 'mobx-react'

import { LayoutRenderer } from './LayoutRenderer.tsx'
import { WorkspaceLayoutMixin } from './model.ts'
import { useLayoutDrag } from './useLayoutDrag.ts'

/**
 * The wiring, end to end: a pointer gesture on a tab reaches the layout.
 *
 * jsdom has no layout engine, so `getBoundingClientRect` and
 * `elementsFromPoint` are stubbed from a map of panel id -> rect. That means
 * this test covers the wiring and NOT the geometry — the geometry is
 * `dropZone.test.ts`, which is pure and needs no DOM at all. Splitting them
 * that way is deliberate: a test that stubs the thing it is checking proves
 * nothing, and drag-and-drop is mostly geometry.
 */

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
  const { drag, onTabPointerDown, onTabPointerMove, onTabPointerUp } =
    useLayoutDrag(session)
  return (
    <LayoutRenderer
      node={session.tree}
      layout={session}
      drag={drag}
      renderPanel={(panelId, viewIds) => (
        <div>
          {viewIds.map(viewId => (
            <button
              key={viewId}
              data-testid={`tab-${viewId}`}
              onPointerDown={e => {
                onTabPointerDown(viewId, e)
              }}
              onPointerMove={onTabPointerMove}
              onPointerUp={onTabPointerUp}
            >
              {viewId} in {panelId}
            </button>
          ))}
        </div>
      )}
    />
  )
})

function stubGeometry(rects: Record<string, DOMRect>) {
  Element.prototype.getBoundingClientRect = function () {
    const id = (this as HTMLElement).dataset.panelId
    return (
      (id && rects[id]) || ({ left: 0, top: 0, width: 0, height: 0 } as DOMRect)
    )
  }
  document.elementsFromPoint = (x: number, y: number) =>
    [...document.querySelectorAll('[data-panel-id]')].filter(el => {
      const r = rects[(el as HTMLElement).dataset.panelId!]
      return (
        !!r &&
        x >= r.left &&
        x <= r.left + r.width &&
        y >= r.top &&
        y <= r.top + r.height
      )
    })
}

// pointer capture is not implemented in jsdom
beforeAll(() => {
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
})

function setup() {
  const session = TestSession.create({ name: 't' })
  const left = session.panels[0]!.id
  session.addViewToPanel(left, 'view-1')
  session.addViewToPanel(left, 'view-2')
  const right = session.splitPanel(left, 'row')
  session.addViewToPanel(right, 'view-3')

  stubGeometry({
    [left]: { left: 0, top: 0, width: 400, height: 400 } as DOMRect,
    [right]: { left: 400, top: 0, width: 400, height: 400 } as DOMRect,
  })
  render(<Harness session={session} />)
  return { session, left, right }
}

test('dragging a tab into the middle of another panel moves it there', () => {
  const { session, right } = setup()
  const tab = screen.getByTestId('tab-view-1')

  act(() => {
    fireEvent.pointerDown(tab, { clientX: 10, clientY: 10 })
    fireEvent.pointerMove(tab, { clientX: 600, clientY: 200 })
  })
  // the panel under the pointer shows where it would land
  expect(document.querySelector('[data-drop-indicator="center"]')).toBeTruthy()

  act(() => {
    fireEvent.pointerUp(tab, { clientX: 600, clientY: 200 })
  })

  expect(session.panelContainingView('view-1')?.id).toBe(right)
  expect(session.panels.length).toBe(2)
  expect(document.querySelector('[data-drop-indicator]')).toBeNull()
})

test('dragging a tab to a panel edge splits it', () => {
  const { session } = setup()
  const tab = screen.getByTestId('tab-view-1')

  act(() => {
    fireEvent.pointerDown(tab, { clientX: 10, clientY: 10 })
    // far right of the right-hand panel
    fireEvent.pointerMove(tab, { clientX: 790, clientY: 200 })
  })
  expect(document.querySelector('[data-drop-indicator="right"]')).toBeTruthy()

  act(() => {
    fireEvent.pointerUp(tab, { clientX: 790, clientY: 200 })
  })

  expect(session.panels.length).toBe(3)
  const home = session.panelContainingView('view-1')!
  expect(home.viewIds).toEqual(['view-1'])
})

test('a click on a tab is not a zero-distance drag', () => {
  const { session, left } = setup()
  const before = session.panels.map(p => p.id)
  const tab = screen.getByTestId('tab-view-1')

  act(() => {
    fireEvent.pointerDown(tab, { clientX: 10, clientY: 10 })
    fireEvent.pointerMove(tab, { clientX: 11, clientY: 10 })
    fireEvent.pointerUp(tab, { clientX: 11, clientY: 10 })
  })

  expect(session.panels.map(p => p.id)).toEqual(before)
  expect(session.panelContainingView('view-1')?.id).toBe(left)
})

test('releasing outside every panel drops nothing', () => {
  const { session, left } = setup()
  const tab = screen.getByTestId('tab-view-1')

  act(() => {
    fireEvent.pointerDown(tab, { clientX: 10, clientY: 10 })
    fireEvent.pointerMove(tab, { clientX: 5000, clientY: 5000 })
    fireEvent.pointerUp(tab, { clientX: 5000, clientY: 5000 })
  })

  expect(session.panelContainingView('view-1')?.id).toBe(left)
  expect(session.panels.length).toBe(2)
})
