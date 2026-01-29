import fs from 'fs/promises'
import path from 'path'

export default async function afterPack({
  appOutDir,
  electronPlatformName,
  packager,
}) {
  // Remove node_modules from the packaged app - everything is bundled
  const resourcesDir = path.join(appOutDir, 'resources')
  const asarPath = path.join(resourcesDir, 'app.asar')
  const unpackedPath = path.join(resourcesDir, 'app.asar.unpacked')

  // Remove unpacked node_modules if present
  try {
    await fs.rm(unpackedPath, { recursive: true, force: true })
  } catch {
    // Ignore if doesn't exist
  }

  // Extract, remove node_modules, and repack asar
  const asar = await import('@electron/asar')
  const tempDir = path.join(appOutDir, '_temp_asar')
  await asar.extractAll(asarPath, tempDir)

  const nodeModulesPath = path.join(tempDir, 'node_modules')
  try {
    await fs.rm(nodeModulesPath, { recursive: true, force: true })
    console.log('Removed node_modules from asar')
  } catch {
    // Ignore if doesn't exist
  }

  await asar.createPackage(tempDir, asarPath)
  await fs.rm(tempDir, { recursive: true, force: true })

  // Linux sandbox fix
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
