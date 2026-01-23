import fs from 'fs'
import path from 'path'

import spawn from 'cross-spawn'

const subDirs = [
  'cgv-vite',
  'lgv-vite',
  'app-vite',
  'cli-node18',
  'jbrowse-img',
]
const root = path.resolve(import.meta.dirname, '..')
const workspaceDirs = ['packages', 'products', 'plugins']

for (const dir of subDirs) {
  fs.mkdirSync(path.join(root, 'component_tests', dir, 'packed'), {
    recursive: true,
  })
}

for (const dir of workspaceDirs) {
  const fullDir = path.join(root, dir)
  if (fs.existsSync(fullDir)) {
    for (const subdir of fs.readdirSync(fullDir)) {
      const pkgDir = path.join(fullDir, subdir)
      const pkgJsonPath = path.join(pkgDir, 'package.json')
      if (fs.existsSync(pkgJsonPath)) {
        const location = pkgDir
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'))
        console.log(`Packing ${pkgJson.name}...`)

        // Use --config.ignore-scripts=false to ensure prepack hooks run,
        // even if user has ignore-scripts=true in their .npmrc (which is
        // useful to avoid postinstall scripts but would otherwise block prepack)
        const { signal, status } = spawn.sync(
          'pnpm',
          ['--config.ignore-scripts=false', 'pack'],
          {
            stdio: 'inherit',
            cwd: location,
            encoding: 'utf8',
          },
        )
        if (signal || (status !== null && status > 0)) {
          console.error(`Failed to pack ${pkgJson.name}`)
          process.exit(status || 1)
        }

        // Verify esm folder exists for packages that should have it
        const esmPath = path.join(location, 'esm')
        if (pkgJson.files?.includes('esm') && !fs.existsSync(esmPath)) {
          console.error(
            `ERROR: ${pkgJson.name} should have esm folder but it doesn't exist!`,
          )
          console.error(`This likely means prepack/build didn't run.`)
          process.exit(1)
        }

        const files = fs.readdirSync(location)
        const tarball = files.find(f => f.endsWith('.tgz'))

        // Verify tarball actually contains esm for packages that need it
        if (tarball && pkgJson.files?.includes('esm')) {
          const tarPath = path.join(location, tarball)
          const stat = fs.statSync(tarPath)
          // A tarball with esm should be at least 10KB for most packages
          if (stat.size < 10000) {
            console.error(
              `ERROR: ${pkgJson.name} tarball is suspiciously small (${stat.size} bytes)`,
            )
            console.error(`Expected esm folder to be included. Tarball: ${tarPath}`)
            process.exit(1)
          }
          console.log(`  Tarball size: ${stat.size} bytes`)
        }
        if (tarball) {
          const newName = tarball.replace(/-\d+\.\d+\.\d+/, '')
          for (const sub of subDirs) {
            fs.copyFileSync(
              path.join(location, tarball),
              path.join(root, 'component_tests', sub, 'packed', newName),
            )
          }
          fs.rmSync(path.join(location, tarball))
        }
      }
    }
  }
}
