const fs = require('fs')

if (process.env.BUILT_TESTS) {
  test('JBrowse Web built', () => {
    expect(fs.existsSync('products/jbrowse-web/build/index.html')).toBeTruthy()
  })

  test('JBrowse Desktop built', () => {
    expect(
      fs.existsSync('products/jbrowse-desktop/build/index.html'),
    ).toBeTruthy()
  })

  test('Protein Widget built', () => {
    expect(
      fs.existsSync(
        'products/jbrowse-protein-widget/umd/jbrowse-protein-viewer.js',
      ),
    ).toBeTruthy()
  })
}

test('can import JBrowse Generator', () => {
  const generatorJbrowse = require('./products/generator-jbrowse')
  expect(typeof generatorJbrowse).toBe('object')
})
