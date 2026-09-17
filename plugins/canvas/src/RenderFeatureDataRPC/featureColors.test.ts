import { attributeColorJexl, attributeColorOf } from './featureColors.ts'

test('an attribute color reads back its attribute, domain and palette', () => {
  expect(attributeColorOf(attributeColorJexl('biotype'))).toEqual({
    attribute: 'biotype',
    domain: [],
    palette: [],
  })
  expect(
    attributeColorOf(attributeColorJexl('biotype', ['a', 'b'], ['red'])),
  ).toEqual({ attribute: 'biotype', domain: ['a', 'b'], palette: ['red'] })
})

test('any other color is not an attribute color', () => {
  expect(attributeColorOf(undefined)).toBeUndefined()
  expect(attributeColorOf('red')).toBeUndefined()
  expect(
    attributeColorOf("jexl:randomColor(getInherited(feature,'biotype'))"),
  ).toBeUndefined()
  expect(
    attributeColorOf(
      "jexl:categoricalColor(getInherited(feature,'biotype'), ['a'], [])",
    ),
  ).toBeUndefined()
})
