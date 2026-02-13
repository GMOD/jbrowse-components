import fs from 'fs'
import path from 'path'

const appDirectory = fs.realpathSync(process.cwd())
const resolveApp = (relativePath: string) =>
  path.resolve(appDirectory, relativePath)

const publicUrlOrPath =
  process.env.NODE_ENV === 'development' ? '/' : './'

export const moduleFileExtensions = ['mjs', 'js', 'ts', 'tsx', 'json', 'jsx']

export default {
  appPath: resolveApp('.'),
  appBuild: resolveApp(process.env.BUILD_PATH || 'build'),
  appPublic: resolveApp('public'),
  appHtml: resolveApp('public/index.html'),
  appIndexJs: resolveApp('src/index.tsx'),
  appSrc: resolveApp('src'),
  appNodeModules: resolveApp('node_modules'),
  publicUrlOrPath,
}
