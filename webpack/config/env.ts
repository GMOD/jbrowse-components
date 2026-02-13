import { execSync } from 'child_process'

const NODE_ENV = process.env.NODE_ENV
if (!NODE_ENV) {
  throw new Error(
    'The NODE_ENV environment variable is required but was not specified.',
  )
}

let gitHash = ''
try {
  gitHash = execSync('git rev-parse --short HEAD').toString().trim()
} catch (e) {
  // Not in a git repo
}

const REACT_APP = /^REACT_APP_/i

export default function getClientEnvironment(publicUrl: string) {
  const raw: Record<string, string | boolean | undefined> = Object.keys(
    process.env,
  )
    .filter(key => REACT_APP.test(key))
    .reduce(
      (env, key) => {
        env[key] = process.env[key]
        return env
      },
      {
        NODE_ENV: process.env.NODE_ENV || 'development',
        PUBLIC_URL: publicUrl,
        WDS_SOCKET_HOST: process.env.WDS_SOCKET_HOST,
        WDS_SOCKET_PATH: process.env.WDS_SOCKET_PATH,
        WDS_SOCKET_PORT: process.env.WDS_SOCKET_PORT,
        FAST_REFRESH: process.env.FAST_REFRESH !== 'false',
        GIT_HASH: gitHash,
      } as Record<string, string | boolean | undefined>,
    )

  const stringified = {
    'process.env': Object.keys(raw).reduce(
      (env, key) => {
        env[key] = JSON.stringify(raw[key])
        return env
      },
      {} as Record<string, string>,
    ),
  }

  return { raw, stringified }
}
