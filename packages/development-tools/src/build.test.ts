import { baseJBrowsePluginWebpackConfig } from './build'

it('produces something', () => {
  const output = baseJBrowsePluginWebpackConfig('/fake/directory', {
    name: 'FakePlugin',
  })
  // @ts-ignore
  delete output.module
  expect(output).toMatchSnapshot()
})
