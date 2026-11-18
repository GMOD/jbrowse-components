import umdConfig from '../../config/webpack/umdConfig.mjs'

export default umdConfig({
  filename: 'react-app.umd.production.min.js',
  library: 'JBrowseReactApp',
})
