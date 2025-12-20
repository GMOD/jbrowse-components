const serveStatic = require('serve-static')

// the default static file serving fails on vcf files due to Content-Encoding
const expressMiddleWare = router => {
  router.use(serveStatic('public'))
}
module.exports = expressMiddleWare
