const path = require('path')
const assert = require('yeoman-assert')
const helpers = require('yeoman-test')

describe('generator-jbrowse:app', () => {
  it('throws when not in the plugins directory', async () =>
    expect(
      helpers.run(path.join(__dirname, '.')).withPrompts({
        correctDir: false,
        type: 'helloWorldMenuBar',
      }),
    ).rejects.toThrow(/Exiting now/))

  it('creates a "Hello World" menu bar', () =>
    helpers
      .run(path.join(__dirname, '.'))
      .withPrompts({ correctDir: true, type: 'helloWorldMenuBar' })
      .then(() =>
        assert.file(['components/HelloWorld.js', 'index.js', 'model.js']),
      ))

  it('throws when trying to create an unimplemented plugin', async () =>
    expect(
      helpers.run(path.join(__dirname, '.')).withPrompts({
        correctDir: true,
        type: 'helloWorldMenuBarAndDrawerWidget',
      }),
    ).rejects.toThrow(/Exiting now/))
})
