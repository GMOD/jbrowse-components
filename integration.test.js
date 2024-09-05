const fs = require('fs')

if (process.env.BUILT_TESTS) {
  test('JBrowse Web built', () => {
    expect(fs.existsSync('products/jbrowse-web/dist/index.html')).toBeTruthy()
  })

  test('JBrowse Desktop built', () => {
    expect(
      fs.existsSync('products/jbrowse-desktop/dist/index.html'),
    ).toBeTruthy()
  })
} else {
  test('skipping build tests', () => {})
}
