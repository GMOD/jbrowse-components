import configFactory from '../LinearMultiSampleVariantDisplay/configSchema.ts'
import stateModelFactory from '../LinearMultiSampleVariantDisplay/model.ts'

const configSchema = configFactory()
const stateModel = stateModelFactory(configSchema)
const config = () =>
  configSchema.create({
    type: 'LinearMultiSampleVariantDisplay',
    displayId: 't',
  })

describe('the retired arrangement props on a variant display snapshot', () => {
  it('fail the load naming rows', () => {
    expect(() =>
      stateModel.create({
        type: 'LinearMultiSampleVariantDisplay',
        configuration: config(),
        subtreeFilter: ['a'],
      } as never),
    ).toThrow(/subtreeFilter on a LinearMultiSampleVariantDisplay: .*rows/)
  })

  // A track's `displays` union asks every member whether an entry is its own
  // by running that member's preprocessor over it, so a MAF display's
  // `subtreeFilter` reaches this one on the way to its own model. It is
  // another display's snapshot, and the answer is "not mine", not a throw.
  it("leave another display type's snapshot alone", () => {
    expect(
      stateModel.is({ type: 'LinearMafDisplay', subtreeFilter: ['a'] }),
    ).toBe(false)
  })
})

describe('the retired domain slot on a variant display config', () => {
  it('fails the load naming rows', () => {
    expect(() =>
      configSchema.create({
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 't',
        domain: ['a'],
      }),
    ).toThrow(/domain on a multi-sample variant display is rows/)
  })

  it("leaves another display type's config alone", () => {
    expect(
      configSchema.is({
        type: 'LinearMafDisplay',
        displayId: 'm',
        domain: ['a'],
      }),
    ).toBe(false)
  })
})

describe('the retired featureColor slot on a variant display config', () => {
  it('fails the load naming color', () => {
    expect(() =>
      configSchema.create({
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 't',
        featureColor: 'jexl:impactColor(feature)',
      }),
    ).toThrow(/featureColor on a multi-sample variant display is color/)
  })
})
