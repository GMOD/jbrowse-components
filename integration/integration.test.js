/* eslint-disable global-require */

xtest('can import JBrowse Web', () => {
  // eslint-disable-next-line import/no-unresolved
  const jbrowseWeb = require('../packages/jbrowse-web')
  console.log(jbrowseWeb)
})

test('can import JBrowse Generator', () => {
  const generatorJbrowse = require('../packages/generator-jbrowse')
  expect(typeof generatorJbrowse).toBe('object')
})
