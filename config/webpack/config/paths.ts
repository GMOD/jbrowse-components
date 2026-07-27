import path from 'path'

const resolve = (p: string) => path.resolve(process.cwd(), p)

export const moduleFileExtensions = ['mjs', 'js', 'ts', 'tsx', 'json', 'jsx']

export const appBuild = resolve('build')
export const appPublic = resolve('public')
export const appHtml = resolve('public/index.html')
export const appIndexJs = resolve('src/index.tsx')
export const appSrc = resolve('src')
