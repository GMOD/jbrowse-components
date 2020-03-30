import Plugin from '@gmod/jbrowse-core/Plugin'
import LollipopRenderer, {
  configSchema as lollipopRendererConfigSchema,
  ReactComponent as LollipopRendererReactComponent,
} from './LollipopRenderer'

export default class extends Plugin {
  install(pluginManager) {
    pluginManager.addRendererType(
      () =>
        // @ts-ignore
        new LollipopRenderer({
          name: 'LollipopRenderer',
          ReactComponent: LollipopRendererReactComponent,
          configSchema: lollipopRendererConfigSchema,
        }),
    )
  }
}
