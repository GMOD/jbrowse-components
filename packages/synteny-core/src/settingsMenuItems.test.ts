import { reorderChromosomesMenuItem } from './settingsMenuItems.ts'

test('Re-order chromosomes... names its dialog and opens it on click', () => {
  const open = jest.fn()
  const item = reorderChromosomesMenuItem(open)
  expect('label' in item && item.label).toBe('Re-order chromosomes...')
  expect('helpText' in item && item.helpText).toMatch(/diagonal/)
  ;(item as { onClick: () => void }).onClick()
  expect(open).toHaveBeenCalledTimes(1)
})
