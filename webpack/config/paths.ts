import fs from 'fs'
import path from 'path'

import getPublicUrlOrPath from '../react-dev-utils/getPublicUrlOrPath.ts'

const appDirectory = fs.realpathSync(process.cwd())
const resolveApp = (relativePath: string) =>
  path.resolve(appDirectory, relativePath)

const publicUrlOrPath = getPublicUrlOrPath(
  process.env.NODE_ENV === 'development',
  JSON.parse(fs.readFileSync(resolveApp('package.json'), 'utf8')).homepage,
  process.env.PUBLIC_URL,
)

const buildPath = process.env.BUILD_PATH || 'build'

export const moduleFileExtensions = ['mjs', 'js', 'ts', 'tsx', 'json', 'jsx']

const resolveModule = (resolveFn: (p: string) => string, filePath: string) => {
  const extension = moduleFileExtensions.find(ext =>
    fs.existsSync(resolveFn(`${filePath}.${ext}`)),
  )
  return extension
    ? resolveFn(`${filePath}.${extension}`)
    : resolveFn(`${filePath}.js`)
}

export default {
  appPath: resolveApp('.'),
  appBuild: resolveApp(buildPath),
  appPublic: resolveApp('public'),
  appHtml: resolveApp('public/index.html'),
  appIndexJs: resolveModule(resolveApp, 'src/index'),
  appPackageJson: resolveApp('package.json'),
  appSrc: resolveApp('src'),
  appTsConfig: resolveApp('tsconfig.json'),
  appNodeModules: resolveApp('node_modules'),
  publicUrlOrPath,
  moduleFileExtensions,
}
