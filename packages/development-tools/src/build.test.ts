import webpack from 'webpack'
import { baseJBrowsePluginWebpackConfig } from './build'

it('produces something', () => {
  const output = baseJBrowsePluginWebpackConfig(webpack, '/fake/directory', {
    name: 'FakePlugin',
  })
  expect(output).toMatchSnapshot()
})
