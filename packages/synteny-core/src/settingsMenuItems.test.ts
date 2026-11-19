import { reorderChromosomesMenuItem } from './settingsMenuItems.ts'

test('Re-order chromosomes... opens its dialog on click', () => {
  const open = jest.fn()
  const item = reorderChromosomesMenuItem(open)
  expect('label' in item && item.label).toBe('Re-order chromosomes...')
  ;(item as { onClick: () => void }).onClick()
  expect(open).toHaveBeenCalledTimes(1)
})
