import fs from 'fs'
import os from 'os'
import path from 'path'
import chalk from 'chalk'
import { JSONSchemaForNPMPackageJsonFiles } from '@schemastore/package'

const fsPromises = fs.promises

type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue }

export async function main() {
  const packageJSONPath = resolvePath('package.json')
  const packageJSON = await readJSON(packageJSONPath)
  const rawPackageName = packageJSON.name
  // ensure that yarn init has been run
  if (rawPackageName === undefined) {
    console.warn(
      chalk.red(
        'No name defined in package.json. Please run "yarn init" (or "npm init") before running "yarn setup" (or "npm run setup").',
      ),
    )
    process.exit(1)
  }
  if (rawPackageName === 'jbrowse-plugin-template') {
    console.warn(
      chalk.red(
        'Please run "yarn init" (or "npm init") before running "yarn setup" (or "npm run setup").',
      ),
    )
    process.exit(1)
  }

  const packageName = getSafePackageName(rawPackageName)
  const prefix = 'jbrowse-plugin-'
  const pluginClassName = toPascalCase(
    packageName.startsWith(prefix)
      ? packageName.slice(prefix.length)
      : packageName,
  )

  updatePackageJSON(pluginClassName, packageJSON, packageJSONPath)
  updateSrcIndex(pluginClassName)
  updateJBrowseConfig(packageName, pluginClassName)
  updateExampleFixture(packageName, pluginClassName)
  updateReadme(rawPackageName, packageJSON.repository)
}

function updatePackageJSON(
  pluginName: string,
  packageJSON: JSONSchemaForNPMPackageJsonFiles,
  packageJSONPath: string,
) {
  // 1. Change "name" in the "jbrowse-plugin" and "config" fields to the name of your project (e.g. "MyProject")
  packageJSON['jbrowse-plugin'].name = pluginName
  if (!packageJSON.config) {
    packageJSON.config = {}
  }
  packageJSON.config.jbrowse.plugin.name = pluginName

  // this overwrites package.json
  writeJSON(packageJSONPath, packageJSON)
}

// replace default plugin name in example plugin class
async function updateSrcIndex(pluginClassName: string) {
  const indexFilePath = resolvePath(path.join('src', 'index.ts'))
  let indexFile = await fsPromises.readFile(indexFilePath, 'utf-8')
  indexFile = indexFile.replace(/TemplatePlugin/g, `${pluginClassName}Plugin`)
  fsPromises.writeFile(indexFilePath, indexFile)
}

// replace default plugin name and url with project name and dist file
async function updateJBrowseConfig(packageName: string, pluginName: string) {
  const jbrowseConfigPath = resolvePath('jbrowse_config.json')
  const jbrowseConfig = await readJSON(jbrowseConfigPath)
  jbrowseConfig.plugins[0].name = pluginName
  jbrowseConfig.plugins[0].url = `http://localhost:9000/dist/${packageName}.umd.development.js`
  writeJSON(jbrowseConfigPath, jbrowseConfig)
}

// replace default plugin name and url with project name and dist file
async function updateExampleFixture(packageName: string, pluginName: string) {
  const fixtureLocation = resolvePath(
    path.join('cypress', 'fixtures', 'hello_view.json'),
  )
  const exampleFixture = await readJSON(fixtureLocation)
  exampleFixture.plugins[0].name = pluginName
  exampleFixture.plugins[0].url = `http://localhost:9000/dist/${packageName}.umd.development.js`
  writeJSON(fixtureLocation, exampleFixture)
}

async function updateReadme(
  packageName: string,
  repository: JSONSchemaForNPMPackageJsonFiles['repository'],
) {
  // add status badge to README
  const repoUrl = getUrlFromRepo(repository)
  const readmePath = resolvePath('README.md')
  const readmeLines = (await fsPromises.readFile(readmePath, 'utf-8')).split(
    /\r?\n/,
  )
  if (readmeLines[0].startsWith(`# ${packageName}`)) {
    return
  }
  readmeLines[0] = `# ${packageName}`
  if (repoUrl !== undefined) {
    readmeLines.unshift(
      `![Integration](${repoUrl}/workflows/Integration/badge.svg?branch=main)${os.EOL}`,
    )
  }
  fsPromises.writeFile(readmePath, readmeLines.join(os.EOL), 'utf8')
}

/*
****************************
Helpers
****************************
*/

async function writeJSON(path: string, data: JSONValue) {
  let jsonString
  try {
    jsonString = JSON.stringify(data, null, 2)
  } catch (error) {
    console.error('There was a problem converting an object to JSON')
    throw error
  }
  return fsPromises.writeFile(path, `${jsonString}\n`)
}

async function readJSON(path: string) {
  let jsonString
  try {
    jsonString = await fsPromises.readFile(path, 'utf8')
  } catch (error) {
    console.error(`Could not read JSON file at ${path}`)
    throw error
  }
  let jsonData
  try {
    jsonData = JSON.parse(jsonString)
  } catch (error) {
    console.error(
      `Could not parse JSON file at ${path}, check for JSON syntax errors`,
    )
    throw error
  }
  return jsonData
}

// snagged from https://stackoverflow.com/a/53952925
function toPascalCase(string: string) {
  return `${string}`
    .replace(new RegExp(/[-_]+/, 'g'), ' ')
    .replace(new RegExp(/[^\w\s]/, 'g'), '')
    .replace(
      new RegExp(/\s+(.)(\w+)/, 'g'),
      ($1, $2, $3) => `${$2.toUpperCase() + $3.toLowerCase()}`,
    )
    .replace(new RegExp(/\s/, 'g'), '')
    .replace(new RegExp(/\w/), s => s.toUpperCase())
}

function getSafePackageName(name: string) {
  return name
    .toLowerCase()
    .replace(/(^@.*\/)|((^[^a-zA-Z]+)|[^\w.-])|([^a-zA-Z0-9]+$)/g, '')
}

function getUrlFromRepo(repo: JSONSchemaForNPMPackageJsonFiles['repository']) {
  if (repo === undefined) {
    return repo
  }
  let url = undefined
  if (typeof repo === 'string') {
    url = repo
  } else if (typeof repo === 'object') {
    url = repo.url
  }

  if (typeof url === 'string') {
    if (url.includes('github.com')) {
      return url.replace(/\.git$/, '')
    }
    if (url.startsWith('github:')) {
      return `https://github.com/${url.split(':')[1]}`
    }
  }
  return undefined
}

function resolvePath(pathToResolve: string) {
  return path.resolve(fs.realpathSync(process.cwd()), pathToResolve)
}
