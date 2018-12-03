const path = require('path')
const assert = require('yeoman-assert')
const helpers = require('yeoman-test')

describe('generator-jbrowse:app', () => {
  beforeAll(() =>
    helpers.run(path.join(__dirname, '.')).withPrompts({ someAnswer: true }),
  )

  it('creates files', () => {
    assert.file(['dummyfile.txt'])
  })
})
