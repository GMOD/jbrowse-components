import fs from 'fs'
import path from 'path'
import { parseArgs } from 'node:util'

export type Platform = 'linux' | 'mac' | 'win'

export function parsePackagingArgs() {
  const { values } = parseArgs({
    options: {
      linux: { type: 'boolean' },
      mac: { type: 'boolean' },
      win: { type: 'boolean' },
      all: { type: 'boolean' },
      'no-installer': { type: 'boolean' },
      publish: { type: 'boolean' },
    },
  })
  const all: Platform[] = ['linux', 'mac', 'win']
  return {
    platforms: values.all ? all : all.filter(p => values[p]),
    noInstaller: Boolean(values['no-installer']),
    publish: Boolean(values.publish),
  }
}

export const ROOT = path.resolve(import.meta.dirname, '../..')
export const DIST = path.join(ROOT, 'dist')
export const BUILD = path.join(ROOT, 'build')
export const ASSETS = path.join(ROOT, 'assets')

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))

export const VERSION = process.env.JBROWSE_VERSION || pkg.version
export const APP_NAME = 'jbrowse-desktop'
export const PRODUCT_NAME = 'JBrowse 2'
export const APP_ID = 'org.jbrowse2.app'
export const APPLE_TEAM_ID = '9KR53J86Q2'
