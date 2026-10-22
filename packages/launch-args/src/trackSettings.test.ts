import { trackSettings } from './trackSettings.ts'

test('the modifiers every track type takes become settings, in order', () => {
  expect(
    trackSettings([
      'height:120',
      'force',
      'showLegend=true',
      '{"height":90,"color":"red"}',
    ]),
  ).toEqual({
    settings: {
      height: 90,
      forceLoad: true,
      showLegend: true,
      color: 'red',
    },
    rest: [],
  })
})

test('a display-specific modifier or a member write is left for the caller', () => {
  expect(
    trackSettings(['color:strand', 'color.field=tags.HP', 'height:50']),
  ).toEqual({
    settings: { height: 50 },
    rest: ['color:strand', 'color.field=tags.HP'],
  })
})

test('a value a shared modifier cannot use throws', () => {
  expect(() => trackSettings(['height:'])).toThrow(
    'Missing height value. Expected height:<a number>.',
  )
  expect(() => trackSettings(['force:maybe'])).toThrow(
    'Invalid force value "maybe". Expected true or false.',
  )
  expect(() => trackSettings(['{bad'])).toThrow('Invalid JSON track option')
})
