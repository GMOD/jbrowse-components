import { createRsbuild } from '@rsbuild/core'
import express from 'express'
import serveStatic from 'serve-static'

async function startDevServer() {
  // Init Rsbuild
  const rsbuild = await createRsbuild({
    rsbuildConfig: {
      server: {
        htmlFallback: false,
      },
      html: {
        title: 'JBrowse',
        favicon: 'public/favicon.ico',
        meta: {
          description: 'A fast and flexible genome browser',
        },
      },
    },
  })

  const app = express()

  // Create Rsbuild DevServer instance
  const rsbuildServer = await rsbuild.createDevServer()

  // serveStatic must be before Rsbuild's middlewares, it avoids issue where
  // Rsbuild adds Content-Encoding:gzip on bgzip files (files ending in .gz)
  // causing errors with tabix et al.
  app.use(serveStatic('public'))

  // Apply Rsbuild’s built-in middlewares
  app.use(rsbuildServer.middlewares)

  const httpServer = app.listen(rsbuildServer.port, async () => {
    // Notify Rsbuild that the custom server has started
    await rsbuildServer.afterListen()
  })

  rsbuildServer.connectWebSocket({
    server: httpServer,
  })
}

startDevServer().catch((e: unknown) => {
  console.error(e)
})
