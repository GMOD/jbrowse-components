import multiSampleConfigFactory from './configSchema.ts'
import multiSampleStateModelFactory from './model.ts'

// Old sessions store a retired `type` on the active display instance; the
// model rewrites it so the type union still resolves and the session loads.
describe('multi-sample variant display rename back-compat', () => {
  it.each([
    'MultiLinearVariantDisplay',
    'LinearMultiSampleVariantMatrixDisplay',
    'LinearVariantMatrixDisplay',
  ])('loads a %s instance as this display', oldType => {
    const configSchema = multiSampleConfigFactory()
    const model = multiSampleStateModelFactory(configSchema)
    const inst = model.create({
      // @ts-expect-error -- testing back-compat: preProcessSnapshot remaps this old type string
      type: oldType,
      configuration: configSchema.create({
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 'old',
      }),
    })
    expect(inst.type).toBe('LinearMultiSampleVariantDisplay')
  })

  // `showTooltips` was a display-instance prop before the rewrite and is a
  // config slot now, so a session saved back then still carries it where no prop
  // declares it. MST drops the key; the session has to load anyway, at the
  // slot's default.
  it('loads an old snapshot carrying the pre-rewrite showTooltips prop', () => {
    const configSchema = multiSampleConfigFactory()
    const model = multiSampleStateModelFactory(configSchema)
    // Spread rather than written inline: the key names no prop, so the object
    // literal's excess-property check would reject the very thing under test.
    const preRewriteProps = { showTooltips: false }
    const inst = model.create({
      type: 'LinearMultiSampleVariantDisplay',
      ...preRewriteProps,
      configuration: configSchema.create({
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 'legacy-tooltips',
      }),
    })
    expect(inst.showTooltips).toBe(true)
  })
})
