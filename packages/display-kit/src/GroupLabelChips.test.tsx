import { createJBrowseTheme } from '@jbrowse/core/ui'
import { OVERFLOW_GROUP_KEY } from '@jbrowse/core/util/groupKeys'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import { GroupLabelChips } from './GroupLabelChips.tsx'

import type React from 'react'

const SECTIONS = [
  { key: 'a', label: 'A', top: 0, height: 100 },
  { key: 'b', label: 'B', top: 100, height: 100 },
  { key: 'c', label: 'C', top: 200, height: 100 },
]

afterEach(() => {
  jest.restoreAllMocks()
})

function hostOf(writtenFacet = {}, hidden: string[] = []) {
  return {
    writtenFacet,
    hiddenGroups: new Set(hidden),
    knownSections: [],
    sectionsHeading: 'Section',
    setFacetSort: jest.fn(),
    hideGroup: jest.fn(),
    showAllGroups: jest.fn(),
    setHiddenGroups: jest.fn(),
  }
}

function renderWithHost(
  host: ReturnType<typeof hostOf>,
  sections: { key: string; label: string; top: number; height: number }[],
  leading?: React.ReactNode,
) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <GroupLabelChips
        canvasHeight={300}
        host={host}
        sections={sections}
        leading={leading}
      />
    </ThemeProvider>,
  )
}

function setup() {
  const host = hostOf({ field: 'f' })
  const view = renderWithHost(host, SECTIONS)
  const pill = (i: number) =>
    view.getAllByTestId('group-label-text')[i]!.parentElement!
  return { ...view, host, pill }
}

function drag(el: Element, fromY: number, toY: number) {
  fireEvent.pointerDown(el, { clientY: fromY, button: 0, pointerId: 1 })
  fireEvent.pointerMove(el, { clientY: toY, pointerId: 1 })
}

test('dropping a chip on a lower section moves it there, the line under that section', () => {
  const { pill, host, getByTestId } = setup()
  drag(pill(0), 5, 250)
  expect(getByTestId('group-drop-line').style.top).toBe('298px')
  fireEvent.pointerUp(pill(0), { clientY: 250, pointerId: 1 })
  expect(host.setFacetSort).toHaveBeenCalledWith(['b', 'c', 'a'])
})

test('a drop above the first section moves to the top, the line over it', () => {
  const { pill, host, getByTestId } = setup()
  drag(pill(2), 205, -40)
  expect(getByTestId('group-drop-line').style.top).toBe('0px')
  fireEvent.pointerUp(pill(2), { clientY: -40, pointerId: 1 })
  expect(host.setFacetSort).toHaveBeenCalledWith(['c', 'a', 'b'])
})

test('a drop on its own section, or a cancelled drag, moves nothing', () => {
  const { pill, host, queryByTestId } = setup()
  drag(pill(1), 105, 150)
  expect(queryByTestId('group-drop-line')).toBeNull()
  fireEvent.pointerUp(pill(1), { clientY: 150, pointerId: 1 })
  drag(pill(1), 105, 250)
  fireEvent.pointerCancel(pill(1), { pointerId: 1 })
  expect(host.setFacetSort).not.toHaveBeenCalled()
})

test('a press that stays put still clicks the hide button, and a drag swallows it', () => {
  const { getAllByTitle, host } = setup()
  const hide = getAllByTitle('Hide "A"')[0]!
  fireEvent.pointerDown(hide, { clientY: 5, button: 0, pointerId: 1 })
  fireEvent.pointerUp(hide, { clientY: 6, pointerId: 1 })
  fireEvent.click(hide)
  expect(host.hideGroup).toHaveBeenCalledTimes(1)
  expect(host.hideGroup).toHaveBeenCalledWith('a')
  drag(hide, 5, 250)
  fireEvent.pointerUp(hide, { clientY: 250, pointerId: 1 })
  fireEvent.click(hide)
  expect(host.hideGroup).toHaveBeenCalledTimes(1)
})

// A browser sends a captured press's click to the capturing pill, never to the
// button pressed, so only a press that becomes a drag may capture.
test('a press on the hide button takes no pointer capture until it drags', () => {
  const capture = jest.spyOn(Element.prototype, 'setPointerCapture')
  const { getAllByTitle, pill } = setup()
  const hide = getAllByTitle('Hide "A"')[0]!
  fireEvent.pointerDown(hide, { clientY: 5, button: 0, pointerId: 1 })
  fireEvent.pointerMove(hide, { clientY: 6, pointerId: 1 })
  fireEvent.pointerUp(hide, { clientY: 6, pointerId: 1 })
  expect(capture).not.toHaveBeenCalled()
  drag(hide, 5, 250)
  expect(capture).toHaveBeenCalledWith(1)
  expect(capture.mock.contexts[0]).toBe(pill(0))
})

test('a press that leaves its pill before the threshold captures, so the drag keeps its pointer', () => {
  const capture = jest.spyOn(Element.prototype, 'setPointerCapture')
  const { pill, host } = setup()
  fireEvent.pointerDown(pill(0), { clientY: 5, button: 0, pointerId: 1 })
  fireEvent.pointerLeave(pill(0), { clientY: 7, pointerId: 1 })
  expect(capture.mock.contexts[0]).toBe(pill(0))
  fireEvent.pointerMove(pill(0), { clientY: 250, pointerId: 1 })
  fireEvent.pointerUp(pill(0), { clientY: 250, pointerId: 1 })
  expect(host.setFacetSort).toHaveBeenCalledWith(['b', 'c', 'a'])
})

test('the leading chips ride the topmost chip on screen, ahead of its pill', () => {
  const view = renderWithHost(
    hostOf(),
    SECTIONS.map(s => ({ ...s, top: s.top - 150 })),
    <span data-testid="lead">Records</span>,
  )
  const chips = view.getAllByTestId('group-label-chip')
  expect(view.getAllByTestId('lead')).toHaveLength(1)
  expect(chips[0]!.firstElementChild).toBe(view.getByTestId('lead'))
  expect(chips[0]!.textContent).toContain('B')
})

test('with every section hidden, the way back stands alone at the top', () => {
  const host = hostOf({}, ['y', 'z'])
  const { getByRole } = renderWithHost(host, [])
  fireEvent.click(getByRole('button', { name: 'Show 2 hidden' }))
  expect(host.showAllGroups).toHaveBeenCalled()
})

test("a host's chips hide their sections but the overflow, restore, and reorder its facet's sort", () => {
  const host = hostOf({ field: 'f', sort: ['c'] }, ['z'])
  const view = renderWithHost(host, [
    ...SECTIONS,
    { key: OVERFLOW_GROUP_KEY, label: 'Other', top: 300, height: 0 },
  ])
  expect(
    view
      .getAllByRole('button')
      .map(b => b.getAttribute('title'))
      .filter(t => t?.startsWith('Hide')),
  ).toEqual(['Hide "A"', 'Hide "B"', 'Hide "C"'])
  fireEvent.click(view.getByTitle('Hide "B"'))
  expect(host.hideGroup).toHaveBeenCalledWith('b')
  fireEvent.click(view.getByRole('button', { name: 'Show 1 hidden' }))
  expect(host.showAllGroups).toHaveBeenCalled()
  const pill = view.getAllByTestId('group-label-text')[0]!.parentElement!
  drag(pill, 5, 250)
  fireEvent.pointerUp(pill, { clientY: 250, pointerId: 1 })
  expect(host.setFacetSort).toHaveBeenCalledWith(['b', 'c', 'a'])
})

test("a host's lone section offers no hide, and with no field no reorder", () => {
  const host = hostOf()
  const lone = renderWithHost(host, SECTIONS.slice(0, 1))
  expect(lone.queryByTitle('Hide "A"')).toBeNull()
  lone.unmount()
  const view = renderWithHost(host, SECTIONS)
  const pill = view.getAllByTestId('group-label-text')[0]!.parentElement!
  drag(pill, 5, 250)
  expect(view.queryByTestId('group-drop-line')).toBeNull()
})
