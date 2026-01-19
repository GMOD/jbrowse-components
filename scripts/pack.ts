import fs from 'fs'
import path from 'path'

import spawn from 'cross-spawn'

const subDirs = ['cgv-vite', 'lgv-vite', 'app-vite']
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
        const { signal, status } = spawn.sync('pnpm', ['pack', '--silent'], {
          stdio: 'inherit',
          cwd: location,
        })
        if (signal || (status !== null && status > 0)) {
          process.exit(status || 1)
        }
        const files = fs.readdirSync(location)
        const tarball = files.find(f => f.endsWith('.tgz'))
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
