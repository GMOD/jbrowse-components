const express = require('express')
const proxy = require('http-proxy-middleware')

const app = express()

app.use(
  '/biomart',
  proxy({
    target: 'http://uswest.ensembl.org',
    changeOrigin: true,
    onProxyRes(proxyRes, req, res) {
      proxyRes.headers['Access-Control-Allow-Origin'] = '*'
    },
  }),
)
app.listen(2999)
