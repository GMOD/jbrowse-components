import { currentVersion as ver } from '../src/config.ts'

const baseURL = `https://github.com/GMOD/jbrowse-components/releases/download`

const baseVer = `${baseURL}/${ver}`

const winDL = `${baseVer}/jbrowse-desktop-${ver}-win.exe`

const macDL = `${baseVer}/jbrowse-desktop-${ver}-mac.dmg`

const linDL = `${baseVer}/jbrowse-desktop-${ver}-linux.AppImage`

export { linDL, macDL, winDL }
