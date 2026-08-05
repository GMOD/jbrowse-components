import PluginManager from './PluginManager.ts'

// The chaining the extension points guide opens with. Its two snippets and the
// "ret is {value:3}" claim under them are generated from here, so the guide
// cannot describe a fold this file does not produce.
//
// 'ExtensionPointName' is deliberately not in ExtensionPointRegistry: it stands
// in for a point a plugin defines itself, which is the untyped path the guide's
// first example is really showing.

test('each callback receives the previous one, and the producer gets the last', () => {
  const pluginManager = new PluginManager([])

  // #region register
  pluginManager.addToExtensionPoint(
    'ExtensionPointName',
    (arg: { value: number }) => {
      return { value: arg.value + 1 }
    },
  )
  // #endregion

  // a second plugin registering on the same point, which is what makes the
  // result below 3 rather than 2
  pluginManager.addToExtensionPoint(
    'ExtensionPointName',
    (arg: { value: number }) => {
      return { value: arg.value + 1 }
    },
  )

  // #region fire
  const ret = pluginManager.evaluateExtensionPoint('ExtensionPointName', {
    value: 1,
  })
  // #endregion

  expect(ret).toEqual({ value: 3 })
})

test('a point nobody registered on returns what the producer passed', () => {
  const pluginManager = new PluginManager([])
  expect(
    pluginManager.evaluateExtensionPoint('ExtensionPointName', { value: 1 }),
  ).toEqual({ value: 1 })
})
