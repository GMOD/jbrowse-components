import PluginManager from '@gmod/jbrowse-core/PluginManager';
import SVG from '@gmod/jbrowse-plugin-svg';
import { getSnapshot } from 'mobx-state-tree';
import ThisPlugin from '.';


test('plugin in a stock JBrowse', () => {
  const pluginManager = new PluginManager([new ThisPlugin(), new SVG()]);
  pluginManager.createPluggableElements();
  pluginManager.configure();
  expect(() => pluginManager.addPlugin(new ThisPlugin())).toThrow(
    /JBrowse already configured, cannot add plugins/,
  );

  const BamAdapter = pluginManager.getAdapterType('BamAdapter');
  const config = BamAdapter.configSchema.create({ type: 'BamAdapter' });
  expect(getSnapshot(config)).toMatchSnapshot();
});
