import { createJBrowseTheme } from '@jbrowse/core/ui'
import { GROUP_LABEL_HEIGHT } from '@jbrowse/display-kit/groupLabelStyle'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import GroupLabelsLayer from './GroupLabelsLayer.tsx'

import type { GroupLabelsModel } from './GroupLabelsLayer.tsx'

function renderLayer(model: GroupLabelsModel) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <GroupLabelsLayer model={model} />
    </ThemeProvider>,
  )
}

const sections = [
  { key: '+', label: 'Forward strand', top: 0, height: 100 },
  { key: '-', label: 'Reverse strand', top: 100, height: 100 },
]

test('one chip per section, a divider above every section but the first', () => {
  const { getAllByTestId, queryAllByTestId } = renderLayer({
    showsGroupLabels: true,
    groupSections: sections,
    scrollTop: 0,
    height: 200,
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
    height: 200,
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
    height: 200,
  })
  expect(queryAllByTestId('group-label-chip')).toHaveLength(0)
})

test('ungrouped draws nothing', () => {
  const { queryAllByTestId } = renderLayer({
    showsGroupLabels: false,
    groupSections: [],
    scrollTop: 0,
    height: 200,
  })
  expect(queryAllByTestId('group-label-chip')).toHaveLength(0)
})
