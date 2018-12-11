const assert = require('yeoman-assert')
const helpers = require('yeoman-test')

describe('generator-jbrowse:app', () => {
  let originalWorkingDirectory
  beforeAll(() => {
    originalWorkingDirectory = process.cwd()
  })

  afterEach(() => process.chdir(originalWorkingDirectory))

  it('throws when not in the plugins directory', async () =>
    expect(
      helpers.run(__dirname).withPrompts({
        correctDir: false,
        type: 'helloWorldMenuBar',
      }),
    ).rejects.toThrow(/Exiting now/))

  it('creates a "Hello World" menu bar', async () => {
    await helpers
      .run(__dirname)
      .withPrompts({ correctDir: true, type: 'helloWorldMenuBar' })
    assert.file([
      'HelloWorldMenuBar/components/HelloWorld.js',
      'HelloWorldMenuBar/index.js',
      'HelloWorldMenuBar/model.js',
    ])
  })

  it('creates a "Hello World" menu bar and drawer widget', async () => {
    await helpers.run(__dirname).withPrompts({
      correctDir: true,
      type: 'helloWorldMenuBarAndDrawerWidget',
    })
    assert.file([
      'HelloWorldMenuBarAndDrawerWidget/components/HelloWorldDrawerWidget.js',
      'HelloWorldMenuBarAndDrawerWidget/components/HelloWorldMenuBar.js',
      'HelloWorldMenuBarAndDrawerWidget/index.js',
      'HelloWorldMenuBarAndDrawerWidget/model.js',
    ])
  })
})
