import ReactComponent from './components/FilteredRendering'

import ServerSideRenderer from '../../renderers/serverSideRenderer'
import { ConfigurationSchema } from '../../configuration'

const configSchema = ConfigurationSchema(
  'FilteredRenderer',
  {},
  { explicitlyTyped: true },
)
class FilteredRenderer extends ServerSideRenderer {
  async getFeatures(renderArgs) {
    const features = await super.getFeatures(renderArgs)
    return features.filter(this.filter.bind(this, renderArgs))
  }

  filter(renderArgs, feature) {
    return true
  }

  async render(renderProps) {
    return this.innerRenderer.render(renderProps)
    const element = React.createElement(this.ReactComponent, renderProps, null)
    return { element }
  }
}

export default (/* pluginManager */) =>
  new FilteredRenderer({
    name: 'FilteredRenderer',
    ReactComponent,
    configSchema,
  })
