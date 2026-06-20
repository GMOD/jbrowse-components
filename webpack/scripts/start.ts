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

  // Reprint a one-line status (with the URL) after every compile so the
  // localhost address stays on screen and success<->error transitions are
  // obvious. `url` is populated once the server is listening (below).
  let url = ''
  compiler.hooks.done.tap('startWebpack', stats => {
    if (url) {
      if (stats.hasErrors()) {
        console.log(chalk.red(`Failed to compile — ${url}`))
      } else if (stats.hasWarnings()) {
        console.log(chalk.yellow(`Compiled with warnings — ${url}`))
      } else {
        console.log(chalk.green(`Compiled successfully — ${url}`))
      }
    }
  })

  const devServer = new WebpackDevServer(
    {
      host: HOST,
      // webpack-dev-middleware unconditionally console.logs stats.toString()
      // after every compile. Limiting stats to errors/warnings still surfaces
      // problem details while suppressing the noisy asset table; the done hook
      // above prints the concise per-compile status line.
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
    }
    const addr = devServer.server?.address()
    if (typeof addr === 'object' && addr) {
      url = `http://localhost:${addr.port}`
      console.log(`You can view ${chalk.bold(appName)} at ${chalk.bold(url)}`)
    }
  })
}
