import { ConfigurationSchema } from './configurationSchema.ts'
import { applyConfSettings } from './getConf.ts'
import { readConfObject } from './readConfObject.ts'
import { getConfigurationSchemaMetadata } from './schemaRegistry.ts'
import { liftRetiredSpellings } from './snapshotPreprocess.ts'

const schema = ConfigurationSchema(
  'Marker',
  {
    size: { type: 'number', defaultValue: 2 },
    color: { type: 'color', defaultValue: 'grey' },
  },
  {
    explicitlyTyped: true,
    retired: {
      diameter: (size: unknown) => ({ size }),
      strokeColor: (color: unknown) => ({ color }),
      renderer: (value: unknown) =>
        value && typeof value === 'object'
          ? { color: (value as Record<string, unknown>).strokeColor }
          : {},
      partitionField: '`rows`',
    },
  },
)

const meta = getConfigurationSchemaMetadata(schema)!
const lift = (snap: Record<string, unknown>) => liftRetiredSpellings(meta, snap)

test('a retired name becomes the member that replaced it', () => {
  expect(lift({ diameter: 9 })).toEqual({ size: 9 })
})

test('the current spelling beside a retired one wins', () => {
  expect(lift({ diameter: 9, size: 3 })).toEqual({ size: 3 })
})

test('the old key goes even where it carried no value', () => {
  expect(lift({ diameter: undefined })).toEqual({})
})

// `migrateRetiredDisplays` rebuilds a track snapshot only where an entry
// changed identity, so returning the same object is what keeps a current
// config off that path.
test('a snapshot spelling none of them is the object it was', () => {
  const snap = { size: 5 }
  expect(lift(snap)).toBe(snap)
})

test('the first declaration wins where two lift onto one member', () => {
  expect(
    lift({ strokeColor: 'red', renderer: { strokeColor: 'blue' } }),
  ).toEqual({ color: 'red' })
  expect(lift({ renderer: { strokeColor: 'blue' } })).toEqual({ color: 'blue' })
})

test('a retired name with no replacement throws naming it', () => {
  expect(() => lift({ partitionField: 'sample' })).toThrow(
    /Marker: `partitionField` is `rows`/,
  )
})

// A `displays` union runs every member's preprocessor over every entry while
// it works out which display an entry is.
test('an entry naming another type is left as it was', () => {
  const snap = { type: 'Other', diameter: 9, partitionField: 'x' }
  expect(lift(snap)).toBe(snap)
})

test('create and a settings bag both read the declaration', () => {
  expect(
    readConfObject(schema.create({ type: 'Marker', diameter: 9 }), 'size'),
  ).toBe(9)

  const conf = schema.create({ type: 'Marker' })
  const report = applyConfSettings(conf, { diameter: 9 })
  expect(report.applied).toEqual(['size'])
  expect(report.undeclared).toEqual({})
  expect(readConfObject(conf, 'size')).toBe(9)
})

test('a subclass adds a spelling without dropping its base’s', () => {
  const child = ConfigurationSchema(
    'BigMarker',
    { weight: { type: 'number', defaultValue: 1 } },
    {
      baseConfiguration: schema,
      explicitlyTyped: true,
      retired: { lineWidth: (weight: unknown) => ({ weight }) },
    },
  )
  const conf = child.create({
    type: 'BigMarker',
    diameter: 9,
    lineWidth: 4,
  })
  expect(readConfObject(conf, 'size')).toBe(9)
  expect(readConfObject(conf, 'weight')).toBe(4)
})
