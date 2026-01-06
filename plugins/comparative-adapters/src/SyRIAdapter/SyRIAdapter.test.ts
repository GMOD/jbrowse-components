import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Adapter from './SyRIAdapter.ts'
import MyConfigSchema from './configSchema.ts'

test('adapter can fetch features from test.syri.out', async () => {
  const adapter = new Adapter(
    MyConfigSchema.create({
      syriLocation: {
        localPath: require.resolve('./test_data/test.syri.out'),
        locationType: 'LocalPathLocation',
      },
      assemblyNames: ['ref', 'query'],
    }),
  )

  // Query from reference assembly perspective (Chr1)
  const features1 = adapter.getFeatures({
    refName: 'Chr1',
    start: 0,
    end: 300000,
    assemblyName: 'ref',
  })

  const fa1 = await firstValueFrom(features1.pipe(toArray()))

  // Should have 6 alignment features on Chr1 (SYNAL1, SYNAL2, INVAL1, TRANSAL1, DUPAL1)
  // Note: NOTAL and parent blocks (SYN, INV, etc.) are filtered out
  expect(fa1.length).toBe(5)
})

test('adapter returns correct syriType for each feature', async () => {
  const adapter = new Adapter(
    MyConfigSchema.create({
      syriLocation: {
        localPath: require.resolve('./test_data/test.syri.out'),
        locationType: 'LocalPathLocation',
      },
      assemblyNames: ['ref', 'query'],
    }),
  )

  const features = adapter.getFeatures({
    refName: 'Chr1',
    start: 0,
    end: 300000,
    assemblyName: 'ref',
  })

  const fa = await firstValueFrom(features.pipe(toArray()))

  // Find features by their uniqueId and verify syriType
  const synal1 = fa.find(f => f.get('uniqueId').includes('SYNAL1'))
  const inval1 = fa.find(f => f.get('uniqueId').includes('INVAL1'))
  const transal1 = fa.find(f => f.get('uniqueId').includes('TRANSAL1'))
  const dupal1 = fa.find(f => f.get('uniqueId').includes('DUPAL1'))

  expect(synal1?.get('syriType')).toBe('SYN')
  expect(inval1?.get('syriType')).toBe('INV')
  expect(transal1?.get('syriType')).toBe('TRANS')
  expect(dupal1?.get('syriType')).toBe('DUP')
})

test('adapter handles inverted duplications correctly', async () => {
  const adapter = new Adapter(
    MyConfigSchema.create({
      syriLocation: {
        localPath: require.resolve('./test_data/test.syri.out'),
        locationType: 'LocalPathLocation',
      },
      assemblyNames: ['ref', 'query'],
    }),
  )

  const features = adapter.getFeatures({
    refName: 'Chr2',
    start: 0,
    end: 100000,
    assemblyName: 'ref',
  })

  const fa = await firstValueFrom(features.pipe(toArray()))

  // Find INVDPAL feature
  const invdpal = fa.find(f => f.get('uniqueId').includes('INVDPAL1'))

  expect(invdpal?.get('syriType')).toBe('DUP')
  expect(invdpal?.get('strand')).toBe(-1) // Should be inverted
  expect(invdpal?.get('copyStatus')).toBe('copyloss')
})

test('adapter can query from query assembly perspective', async () => {
  const adapter = new Adapter(
    MyConfigSchema.create({
      syriLocation: {
        localPath: require.resolve('./test_data/test.syri.out'),
        locationType: 'LocalPathLocation',
      },
      assemblyNames: ['ref', 'query'],
    }),
  )

  // Query from query assembly perspective (Chr2 in query)
  const features = adapter.getFeatures({
    refName: 'Chr2',
    start: 0,
    end: 100000,
    assemblyName: 'query',
  })

  const fa = await firstValueFrom(features.pipe(toArray()))

  // Should find features that have Chr2 as the query chromosome
  // TRANSAL1 has Chr2 as query, SYNAL3 has Chr2 as both, INVDPAL1 has Chr2 as both
  expect(fa.length).toBeGreaterThan(0)

  // Verify mate points to reference assembly
  const feat = fa[0]!
  expect(feat.get('mate').assemblyName).toBe('ref')
})

test('adapter sets strand correctly for inversions', async () => {
  const adapter = new Adapter(
    MyConfigSchema.create({
      syriLocation: {
        localPath: require.resolve('./test_data/test.syri.out'),
        locationType: 'LocalPathLocation',
      },
      assemblyNames: ['ref', 'query'],
    }),
  )

  const features = adapter.getFeatures({
    refName: 'Chr1',
    start: 100000,
    end: 160000,
    assemblyName: 'ref',
  })

  const fa = await firstValueFrom(features.pipe(toArray()))

  const inval = fa.find(f => f.get('annotationType') === 'INVAL')
  const synal = fa.find(f => f.get('annotationType') === 'SYNAL')

  expect(inval?.get('strand')).toBe(-1) // Inverted
  // SYNAL features should be forward strand unless explicitly inverted
})

test('adapter filters out non-alignment rows', async () => {
  const adapter = new Adapter(
    MyConfigSchema.create({
      syriLocation: {
        localPath: require.resolve('./test_data/test.syri.out'),
        locationType: 'LocalPathLocation',
      },
      assemblyNames: ['ref', 'query'],
    }),
  )

  const features = adapter.getFeatures({
    refName: 'Chr1',
    start: 0,
    end: 1000000,
    assemblyName: 'ref',
  })

  const fa = await firstValueFrom(features.pipe(toArray()))

  // Should NOT include NOTAL, SYN (parent block), INV (parent block), etc.
  const annotationTypes = fa.map(f => f.get('annotationType'))

  expect(annotationTypes).not.toContain('NOTAL')
  expect(annotationTypes).not.toContain('SYN')
  expect(annotationTypes).not.toContain('INV')
  expect(annotationTypes).not.toContain('TRANS')
  expect(annotationTypes).not.toContain('DUP')

  // Should only include alignment types
  for (const type of annotationTypes) {
    expect(type.endsWith('AL')).toBe(true)
  }
})
