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

  it('creates a "Hello World" menu bar and drawer widget', async () => {
    await helpers.run(__dirname).withPrompts({
      correctDir: true,
      type: 'helloWorldMenuBarAndDrawerWidget',
    })
    ;[
      'HelloWorldMenuBarAndDrawerWidget/components/HelloWorldDrawerWidget.js',
      'HelloWorldMenuBarAndDrawerWidget/components/HelloWorldMenuBar.js',
      'HelloWorldMenuBarAndDrawerWidget/index.js',
      'HelloWorldMenuBarAndDrawerWidget/model.js',
    ].forEach(file => expect(fs.existsSync(file)).toBe(true))
  })
})
