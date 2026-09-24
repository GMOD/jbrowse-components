// A capture run names the palette on the page before the app loads, and the
// dealer reads it once, when its module loads.
test('a palette named before the dealer loads replaces every dealt palette', async () => {
  const page = globalThis as { jbrowseRowPalette?: unknown }
  page.jbrowseRowPalette = '#010101,#020202'
  try {
    await jest.isolateModulesAsync(async () => {
      const { dealRowColors } = await import('./colorConfigSchema.ts')
      const dealt = dealRowColors(
        ['a', 'b', 'c'],
        { domain: [], range: ['#0000ff'] },
        ['#ff0000'],
      )
      expect(Object.fromEntries(dealt)).toEqual({
        a: '#0000ff',
        b: '#010101',
        c: '#020202',
      })
    })
  } finally {
    delete page.jbrowseRowPalette
  }
})
