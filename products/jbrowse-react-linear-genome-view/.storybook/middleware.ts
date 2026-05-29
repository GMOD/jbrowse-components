import serveStatic from 'serve-static'

import type { Router } from 'express'

// the default static file serving fails on vcf files due to Content-Encoding
const expressMiddleWare = (router: Router) => {
  router.use(serveStatic('public'))
}
export default expressMiddleWare
