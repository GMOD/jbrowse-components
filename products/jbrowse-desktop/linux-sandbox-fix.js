import fs from 'fs/promises'
import path from 'path'

export default async function afterPack({ appOutDir, electronPlatformName, packager }) {
  if (electronPlatformName !== 'linux') {
    return
  }

  const appName = packager.appInfo.productFilename
  const script = `#!/bin/bash\n"\${BASH_SOURCE%/*}"/${appName}.bin --no-sandbox "$@"`
  const scriptPath = path.join(appOutDir, appName)

  await fs.rename(scriptPath, `${scriptPath}.bin`)
  await fs.writeFile(scriptPath, script)
  await fs.chmod(scriptPath, 0o755)
}
