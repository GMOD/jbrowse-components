import fs from 'fs'
import path from 'path'

export const ROOT = path.resolve(import.meta.dirname, '../..')
export const DIST = path.join(ROOT, 'dist')
export const BUILD = path.join(ROOT, 'build')
export const ASSETS = path.join(ROOT, 'assets')

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))

export const VERSION = pkg.version
export const APP_NAME = 'jbrowse-desktop'
export const PRODUCT_NAME = 'JBrowse 2'
export const APP_ID = 'org.jbrowse2.app'
export const APPLE_TEAM_ID = '9KR53J86Q2'
