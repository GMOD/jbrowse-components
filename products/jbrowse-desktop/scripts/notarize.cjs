require('dotenv').config()
const { notarize } = require('@electron/notarize')

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context
  if (!process.env.GITHUB_ACTIONS || electronPlatformName !== 'darwin') {
    return
  }

  const appName = context.packager.appInfo.productFilename

  return notarize({
    tool: 'notarytool',
    teamId: '9KR53J86Q2',
    appBundleId: 'org.jbrowse2.app',
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLEID,
    appleIdPassword: process.env.APPLEIDPASS,
  })
}
