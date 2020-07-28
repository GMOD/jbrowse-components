const fs = require('fs')
const helpers = require('yeoman-test')
const path = require('path')

describe('generator-jbrowse:app', () => {
  let originalWorkingDirectory
  beforeAll(() => {
    originalWorkingDirectory = path.join(__dirname, '..', '..', '..', '..')
  })

  afterEach(() => process.chdir(originalWorkingDirectory))

  it('creates a "Hello World" menu bar', async () => {
    await helpers
      .run(__dirname)
      .withPrompts({ correctDir: true, type: 'helloWorldMenuBar' })
    ;[
      'HelloWorldMenuBar/components/HelloWorld.js',
      'HelloWorldMenuBar/index.js',
      'HelloWorldMenuBar/model.js',
    ].forEach(file => expect(fs.existsSync(file)).toBe(true))
  })

  it('creates a "Hello World" menu bar and widget', async () => {
    await helpers.run(__dirname).withPrompts({
      correctDir: true,
      type: 'helloWorldMenuBarAndWidget',
    })
    ;[
      'HelloWorldMenuBarAndWidget/components/HelloWorldWidget.js',
      'HelloWorldMenuBarAndWidget/components/HelloWorldMenuBar.js',
      'HelloWorldMenuBarAndWidget/index.js',
      'HelloWorldMenuBarAndWidget/model.js',
    ].forEach(file => expect(fs.existsSync(file)).toBe(true))
  })
})
