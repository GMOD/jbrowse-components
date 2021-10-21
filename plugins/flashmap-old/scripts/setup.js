const fs = require('fs')
const os = require('os')
const path = require('path')

function main() {
  const packageJSON = require('../package.json')
  const { name: projectName } = packageJSON

  // ensure that yarn init has been run
  if (projectName === undefined) {
    console.log(
      'Warning: no name defined in package.json. Please run "yarn init" before "yarn setup".',
    )
    process.exit(1)
  }

  // guess if setup has already been run
  let alreadyRun = false
  if (packageJSON['jbrowse-plugin'].name !== 'MyProject') {
    alreadyRun = true
  }

  const pluginName = getPluginName(projectName)
  const tsdxName = getTsdxPackageName(projectName)

  updatePackageJSON(packageJSON, tsdxName, pluginName)
  updateJBrowseConfig(tsdxName, pluginName)
  updateExampleFixture(tsdxName, pluginName)
  makeJBrowseDir()

  if (!alreadyRun) {
    setupGithubAction(packageJSON, projectName)
  }
}

function updatePackageJSON(packageJSON, tsdxName, pluginName) {
  // 1. Change "name" in the "jbrowse-plugin" field to the name of your project (e.g. "MyProject")
  packageJSON['jbrowse-plugin'].name = pluginName

  // 2. In the "scripts" field, replace the default name with the name of your project, prefixed with "JBrowsePlugin" in the "start" and "build" entries
  packageJSON.scripts.start = `tsdx watch --verbose --noClean --format umd --name JBrowsePlugin${pluginName} --onFirstSuccess "yarn serve --cors --listen 9000 ."`

  packageJSON.scripts.build = `tsdx build --format cjs,esm,umd --name JBrowsePlugin${pluginName}`

  // 3. In the "module" field, replace jbrowse-plugin-my-project with the name of your project (leave off the @myscope if using a scoped package name) (you can double-check that the filename is correct after running the build step below and comparing the filename to the file in the dist/ folder)
  packageJSON.module = `dist/${tsdxName}.esm.js`

  // this overwrites package.json
  writeJSON(packageJSON, 'package.json')
}

// replace default plugin name and url with project name and dist file
function updateJBrowseConfig(tsdxName, pluginName) {
  const jbrowseConfig = require('../jbrowse_config.json')
  jbrowseConfig.plugins[0].name = pluginName
  jbrowseConfig.plugins[0].url = `http://localhost:9000/dist/${tsdxName}.umd.development.js`
  writeJSON(jbrowseConfig, 'jbrowse_config.json')
}

// replace default plugin name and url with project name and dist file
function updateExampleFixture(tsdxName, pluginName) {
  const exampleFixture = require('../cypress/fixtures/hello_view.json')
  exampleFixture.plugins[0].name = pluginName
  exampleFixture.plugins[0].url = `http://localhost:9000/dist/${tsdxName}.umd.development.js`
  writeJSON(exampleFixture, 'cypress/fixtures/hello_view.json')
}

// create a dot directory for the jbrowse build to live in
function makeJBrowseDir() {
  if (!fs.existsSync('.jbrowse')) {
    fs.mkdirSync('.jbrowse')
  }
}

function setupGithubAction(packageJSON, projectName) {
  // move integration test into workflow folder
  if (!fs.existsSync(path.join('.github', 'workflows'))) {
    fs.mkdirSync(path.join('.github', 'workflows'), { recursive: true })
  }
  fs.renameSync(
    'integration.yml',
    path.join('.github', 'workflows', 'integration.yml'),
  )

  // add status badge to README
  const repoUrl = parseRepoUrl(packageJSON.repository)
  if (repoUrl !== undefined) {
    let README = readFile('README.md').split(/\r?\n/)
    README.unshift(
      `![Integration](${repoUrl}/workflows/Integration/badge.svg?branch=main)${os.EOL}`,
    )
    README[1] = `# ${projectName}`
    fs.writeFileSync('README.md', README.join(os.EOL), 'utf8')
  } else {
    let README = readFile('README.md').split(/\r?\n/)
    README[0] = `# ${projectName}`
    fs.writeFileSync('README.md', README.join(os.EOL), 'utf8')
  }
}

/*
****************************
Helpers
****************************
*/

function writeJSON(data, path) {
  try {
    fs.writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`)
  } catch (err) {
    console.error(err)
  }
}

function readFile(path) {
  try {
    return fs.readFileSync(path, 'utf8')
  } catch (err) {
    console.error(err)
    return false
  }
}

// snagged from https://stackoverflow.com/a/53952925
function toPascalCase(string) {
  return `${string}`
    .replace(new RegExp(/[-_]+/, 'g'), ' ')
    .replace(new RegExp(/[^\w\s]/, 'g'), '')
    .replace(
      new RegExp(/\s+(.)(\w+)/, 'g'),
      ($1, $2, $3) => `${$2.toUpperCase() + $3.toLowerCase()}`,
    )
    .replace(new RegExp(/\s/, 'g'), '')
    .replace(new RegExp(/\w/), (s) => s.toUpperCase())
}

function getTsdxPackageName(projectName) {
  // From TSDX utils
  return projectName
    .toLowerCase()
    .replace(/(^@.*\/)|((^[^a-zA-Z]+)|[^\w.-])|([^a-zA-Z0-9]+$)/g, '')
}

function parseRepoUrl(repo) {
  let url
  if (repo !== undefined) {
    if (typeof repo === 'string') {
      url = repo
    } else if (typeof repo === 'object') {
      url = repo.url
    }
  }

  if (typeof url === 'string') {
    if (url.includes('github.com')) {
      return url.replace(/\.git$/, '')
    }
    if (url.startsWith('github:')) {
      return `https://github.com/${url.split(':')[1]}`
    }
  } else {
    return undefined
  }
}

function getPluginName(projectName) {
  let pluginName = projectName

  // strip namespace
  if (projectName.startsWith('@')) {
    pluginName = pluginName.split('/')[1]
  }

  // strip 'jbrowse-plugin-'
  if (pluginName.startsWith('jbrowse-plugin-')) {
    pluginName = pluginName.replace(/jbrowse-plugin-/, '')
  }

  // convert to pascal case
  pluginName = toPascalCase(pluginName)

  return pluginName
}

main()
