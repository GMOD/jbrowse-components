import { drawerGridTemplateColumns } from './drawerLayout.ts'

test('no drawer: single main column', () => {
  expect(
    drawerGridTemplateColumns({
      drawerVisible: false,
      drawerPosition: 'right',
      drawerWidth: 384,
    }),
  ).toBe('[main] minmax(0, 1fr)')
})

test('right drawer sits after main', () => {
  expect(
    drawerGridTemplateColumns({
      drawerVisible: true,
      drawerPosition: 'right',
      drawerWidth: 384,
    }),
  ).toBe('[main] minmax(0, 1fr) [drawer] 384px')
})

test('left drawer sits before main', () => {
  expect(
    drawerGridTemplateColumns({
      drawerVisible: true,
      drawerPosition: 'left',
      drawerWidth: 300,
    }),
  ).toBe('[drawer] 300px [main] minmax(0, 1fr)')
})
