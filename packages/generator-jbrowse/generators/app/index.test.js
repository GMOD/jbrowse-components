const fs = require('fs')
const helpers = require('yeoman-test')

describe('generator-jbrowse:app', () => {
  let originalWorkingDirectory
  beforeAll(() => {
    originalWorkingDirectory = process.cwd()
  })

  afterEach(() => process.chdir(originalWorkingDirectory))

  it('throws when not in the plugins directory', async () => {
    await helpers.run(__dirname).withPrompts({
      correctDir: false,
      type: 'helloWorldMenuBar',
    })
    const files = fs.readdirSync('.')
    expect(files.length).toBe(0)
  })

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
