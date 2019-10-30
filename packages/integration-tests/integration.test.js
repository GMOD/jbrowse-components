const fs = require('fs')

if (process.env.BUILT_TESTS) {
  test('JBrowse Web built', () => {
    expect(fs.existsSync('packages/jbrowse-web/build/index.html')).toBeTruthy()
  })

  test('Protein Widget built', () => {
    expect(
      fs.existsSync('packages/protein-widget/umd/jbrowse-protein-viewer.js'),
    ).toBeTruthy()
  })
}

test('can import JBrowse Generator', () => {
  const generatorJbrowse = require('../generator-jbrowse')
  expect(typeof generatorJbrowse).toBe('object')
})
