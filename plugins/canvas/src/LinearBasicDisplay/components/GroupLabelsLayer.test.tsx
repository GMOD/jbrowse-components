import { createJBrowseTheme } from '@jbrowse/core/ui'
import { GROUP_LABEL_HEIGHT } from '@jbrowse/display-kit/groupLabelStyle'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import GroupLabelsLayer from './GroupLabelsLayer.tsx'

import type { GroupLabelsModel } from './GroupLabelsLayer.tsx'

function layerModel(
  model: Partial<GroupLabelsModel> &
    Pick<GroupLabelsModel, 'showsGroupLabels' | 'groupSections' | 'scrollTop'>,
): GroupLabelsModel {
  return {
    height: 200,
    hiddenGroups: new Set(),
    hideGroup: jest.fn(),
    showAllGroups: jest.fn(),
    ...model,
  }
}

function layer(model: GroupLabelsModel) {
  return (
    <ThemeProvider theme={createJBrowseTheme()}>
      <GroupLabelsLayer model={model} />
    </ThemeProvider>
  )
}

function renderLayer(model: Parameters<typeof layerModel>[0]) {
  return render(layer(layerModel(model)))
}

const sections = [
  { key: '1', label: 'Forward strand', top: 0, height: 100 },
  { key: '-1', label: 'Reverse strand', top: 100, height: 100 },
]

test('one chip per section, a divider above every section but the first', () => {
  const { getAllByTestId, queryAllByTestId } = renderLayer({
    showsGroupLabels: true,
    groupSections: sections,
    scrollTop: 0,
  })
  expect(getAllByTestId('group-label-text').map(el => el.textContent)).toEqual([
    'Forward strand',
    'Reverse strand',
  ])
  expect(queryAllByTestId('group-divider')).toHaveLength(1)
})

test('a chip pins to the canvas top while its section scrolls past', () => {
  const { getAllByTestId } = renderLayer({
    showsGroupLabels: true,
    groupSections: sections,
    scrollTop: 50,
  })
  const [first, second] = getAllByTestId('group-label-chip')
  expect(first!.style.top).toBe('1px')
  expect(second!.style.top).toBe(`${100 - 50 + 1}px`)
})

test('a section scrolled wholly off screen draws nothing', () => {
  const { queryAllByTestId } = renderLayer({
    showsGroupLabels: true,
    groupSections: sections,
    scrollTop: 100 + GROUP_LABEL_HEIGHT + 200,
  })
  expect(queryAllByTestId('group-label-chip')).toHaveLength(0)
})

test("a chip's hide button hides its section, and a lone section offers none", () => {
  const model = layerModel({
    showsGroupLabels: true,
    groupSections: sections,
    scrollTop: 0,
  })
  const { getByTitle, rerender, queryByTitle } = render(layer(model))
  fireEvent.click(getByTitle('Hide "Reverse strand"'))
  expect(model.hideGroup).toHaveBeenCalledWith('-1')

  rerender(layer({ ...model, groupSections: sections.slice(0, 1) }))
  expect(queryByTitle('Hide "Forward strand"')).toBeNull()
})

test('the topmost chip on screen carries the restore for hidden sections', () => {
  const model = layerModel({
    showsGroupLabels: true,
    groupSections: sections,
    scrollTop: 0,
  })
  const { queryByTitle, getByTitle, rerender, getAllByTestId } = render(
    layer(model),
  )
  expect(queryByTitle('Show 1 hidden group')).toBeNull()

  rerender(layer({ ...model, hiddenGroups: new Set(['']) }))
  const restore = getByTitle('Show 1 hidden group')
  expect(restore.closest('[data-testid="group-label-chip"]')).toBe(
    getAllByTestId('group-label-chip')[0],
  )
  fireEvent.click(restore)
  expect(model.showAllGroups).toHaveBeenCalled()

  rerender(
    layer({
      ...model,
      hiddenGroups: new Set(['']),
      scrollTop: 100 + GROUP_LABEL_HEIGHT,
    }),
  )
  expect(
    getByTitle('Show 1 hidden group').closest(
      '[data-testid="group-label-chip"]',
    )!.textContent,
  ).toContain('Reverse strand')
})

test('ungrouped draws nothing', () => {
  const { queryAllByTestId } = renderLayer({
    showsGroupLabels: false,
    groupSections: [],
    scrollTop: 0,
  })
  expect(queryAllByTestId('group-label-chip')).toHaveLength(0)
})
