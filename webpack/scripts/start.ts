import fs from 'fs'
import net from 'net'

import browserslist from 'browserslist'
import chalk from 'chalk'
import webpack from 'webpack'
// eslint-disable-next-line import-x/default
import WebpackDevServer from 'webpack-dev-server'

process.on('unhandledRejection', err => {
  throw err
})

process.env.NODE_ENV = 'development'

if (browserslist.loadConfig({ path: process.cwd() }) == null) {
  console.error(
    chalk.red(
      'You must specify targeted browsers in package.json browserslist.',
    ),
  )
  process.exit(1)
}

const HOST = process.env.HOST || '0.0.0.0'

function isPortFree(port: number) {
  return new Promise<boolean>(resolve => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close()
      resolve(true)
    })
    server.listen(port)
  })
}

export default async function startWebpack(config: webpack.Configuration) {
  const appName = JSON.parse(fs.readFileSync('package.json', 'utf8'))
    .name as string
  const wsProtocol = process.env.HTTPS === 'true' ? 'wss' : 'ws'

  // Quiet webpack-dev-server's startup chatter (Project is running at /
  // Loopback / Content not from webpack).
  config.infrastructureLogging = { level: 'warn' }
  const compiler = webpack(config)

  const devServer = new WebpackDevServer(
    {
      host: HOST,
      // webpack-dev-middleware unconditionally console.logs stats.toString()
      // after every compile. Limiting stats to errors/warnings makes a clean
      // recompile produce an empty string (so nothing prints) while still
      // surfacing problems.
      devMiddleware: { stats: { all: false, errors: true, warnings: true } },
      port: process.env.PORT
        ? Number.parseInt(process.env.PORT, 10)
        : (await isPortFree(3000))
          ? 3000
          : 'auto',
      hot: false,
      open: appName === '@jbrowse/web',
      client: {
        webSocketURL: {
          hostname: 'localhost',
          pathname: '/ws',
          protocol: wsProtocol,
        },
      },
      static: {
        serveIndex: true,
        staticOptions: { dotfiles: 'allow' },
      },
    },
    compiler,
  )
  devServer.startCallback(err => {
    if (err) {
      console.log(err.message)
      process.exit(1)
      return
    }
    const addr = devServer.server?.address()
    if (typeof addr === 'object' && addr) {
      console.log(
        `You can view ${chalk.bold(appName)} at http://localhost:${chalk.bold(addr.port)}`,
      )
    }
  })
}
