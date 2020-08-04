/* eslint-disable no-underscore-dangle */
const Generator = require('yeoman-generator')
const chalk = require('chalk')
const yosay = require('yosay')
const path = require('path')

module.exports = class extends Generator {
  async prompting() {
    // Have Yeoman greet the user.
    this.log(
      yosay(
        `Welcome to the finest ${chalk.red('generator-jbrowse')} generator!`,
      ),
    )

    const dirPrompt = await this.prompt([
      {
        type: 'confirm',
        name: 'correctDir',
        message:
          'Are you in the JBrowse plugins directory?\n(e.g. ~/jbrowse-components/packages/jbrowse-web/src/plugins)',
      },
    ])

    if (!dirPrompt.correctDir) {
      this.log.error(
        chalk.red('Please change directory to the JBrowse plugins directory'),
      )
      this.props = {}
      return
    }

    this.props = await this.prompt([
      {
        type: 'list',
        name: 'type',
        message: 'Please select a sample plugin to generate',
        choices: [
          {
            name: '"Hello World" Menu Bar',
            value: 'helloWorldMenuBar',
          },
          {
            name: '"Hello World" Menu Bar and Widget',
            value: 'helloWorldMenuBarAndWidget',
          },
        ],
      },
    ])
  }

  writing() {
    switch (this.props.type) {
      case 'helloWorldMenuBar':
        this._writeHelloWorldMenuBar()
        break
      case 'helloWorldMenuBarAndWidget':
        this._writeHelloWorldMenuBarAndWidget()
        break
      default:
        // unknown plugin type
        break
    }
  }

  _writeHelloWorldMenuBar() {
    const pluginFiles = ['components/HelloWorld.js', 'index.js', 'model.js']
    pluginFiles.forEach(pluginFile =>
      this.fs.copy(
        this.templatePath(path.join('HelloWorldMenuBar', pluginFile)),
        this.destinationPath(path.join('HelloWorldMenuBar', pluginFile)),
      ),
    )
  }

  _writeHelloWorldMenuBarAndWidget() {
    const pluginFiles = [
      'components/HelloWorldWidget.js',
      'components/HelloWorldMenuBar.js',
      'index.js',
      'model.js',
    ]
    pluginFiles.forEach(pluginFile =>
      this.fs.copy(
        this.templatePath(path.join('HelloWorldMenuBarAndWidget', pluginFile)),
        this.destinationPath(
          path.join('HelloWorldMenuBarAndWidget', pluginFile),
        ),
      ),
    )
  }
}
