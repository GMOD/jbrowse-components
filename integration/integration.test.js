/* eslint-disable global-require */
const fs = require('fs')

test('JBrowse Web built', () => {
  expect(fs.existsSync('packages/jbrowse-web/build/index.html')).toBeTruthy()
})

test('can import JBrowse Generator', () => {
  const generatorJbrowse = require('../packages/generator-jbrowse')
  expect(typeof generatorJbrowse).toBe('object')
})
