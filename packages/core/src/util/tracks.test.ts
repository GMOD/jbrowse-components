import { types } from '@jbrowse/mobx-state-tree'

import { ConfigurationSchema } from '../configuration/configurationSchema.ts'
import { getFileHandle, verifyPermission } from './fileHandleStore.ts'
import {
  findFileHandleIds,
  getConfAssemblyNames,
  getConfAssemblyNamesOrNone,
  getFileName,
  getRpcSessionId,
  getTrackName,
  pickDisplayForView,
  restoreFileHandles,
  stripFileExtension,
} from './tracks.ts'

jest.mock('./fileHandleStore.ts', () => ({
  getFileHandle: jest.fn(),
  storeFileHandle: jest.fn(),
  verifyPermission: jest.fn(),
}))

describe('pickDisplayForView', () => {
  // a multi-sample VCF track: two displays declared, matrix first, plus the
  // display types its track type offers beyond what this view supports
  const declaredDisplays = [
    { type: 'MatrixDisplay', displayId: 'vcf_matrix' },
    { type: 'RegularDisplay', displayId: 'vcf_regular' },
  ]
  const trackDisplayTypes = ['ChordDisplay', 'MatrixDisplay', 'RegularDisplay']
  const viewDisplayTypes = ['MatrixDisplay', 'RegularDisplay']

  test('a requested type gets its own config, not the first declared one', () => {
    expect(
      pickDisplayForView({
        declaredDisplays,
        requestedType: 'RegularDisplay',
        trackDisplayTypes,
        viewDisplayTypes,
      }),
    ).toEqual({
      type: 'RegularDisplay',
      conf: { type: 'RegularDisplay', displayId: 'vcf_regular' },
    })
  })

  test('no requested type takes the first declared display the view supports', () => {
    expect(
      pickDisplayForView({
        declaredDisplays: [
          { type: 'ChordDisplay', displayId: 'vcf_chord' },
          ...declaredDisplays,
        ],
        requestedType: undefined,
        trackDisplayTypes,
        viewDisplayTypes,
      }),
    ).toEqual({
      type: 'MatrixDisplay',
      conf: { type: 'MatrixDisplay', displayId: 'vcf_matrix' },
    })
  })

  test('falls back to the track type when the config declares no displays', () => {
    expect(
      pickDisplayForView({
        declaredDisplays: [],
        requestedType: undefined,
        trackDisplayTypes,
        viewDisplayTypes,
      }),
    ).toEqual({ type: 'MatrixDisplay', conf: undefined })
  })

  test('a requested type the config never declares has no conf to attach', () => {
    expect(
      pickDisplayForView({
        declaredDisplays,
        requestedType: 'ChordDisplay',
        trackDisplayTypes,
        viewDisplayTypes,
      }),
    ).toEqual({ type: 'ChordDisplay', conf: undefined })
  })

  test('undefined when the view supports none of the track’s displays', () => {
    expect(
      pickDisplayForView({
        declaredDisplays: [{ type: 'ChordDisplay', displayId: 'vcf_chord' }],
        requestedType: undefined,
        trackDisplayTypes: ['ChordDisplay'],
        viewDisplayTypes,
      }),
    ).toBeUndefined()
  })
})

describe('findFileHandleIds', () => {
  test('finds FileHandleLocation in flat object', () => {
    const obj = {
      location: {
        locationType: 'FileHandleLocation',
        handleId: 'fh123',
        name: 'test.bam',
      },
    }
    const result = findFileHandleIds(obj)
    expect(result.size).toBe(1)
    expect(result.has('fh123')).toBe(true)
  })

  test('finds multiple FileHandleLocations', () => {
    const obj = {
      fileLocation: {
        locationType: 'FileHandleLocation',
        handleId: 'fh1',
        name: 'test.bam',
      },
      indexLocation: {
        locationType: 'FileHandleLocation',
        handleId: 'fh2',
        name: 'test.bam.bai',
      },
    }
    const result = findFileHandleIds(obj)
    expect(result.size).toBe(2)
    expect(result.has('fh1')).toBe(true)
    expect(result.has('fh2')).toBe(true)
  })

  test('finds FileHandleLocation in nested object', () => {
    const obj = {
      adapter: {
        type: 'BamAdapter',
        bamLocation: {
          locationType: 'FileHandleLocation',
          handleId: 'fh-nested',
          name: 'nested.bam',
        },
      },
    }
    const result = findFileHandleIds(obj)
    expect(result.size).toBe(1)
    expect(result.has('fh-nested')).toBe(true)
  })

  test('finds FileHandleLocation in arrays', () => {
    const obj = {
      tracks: [
        {
          adapter: {
            fileLocation: {
              locationType: 'FileHandleLocation',
              handleId: 'fh-arr-1',
              name: 'file1.vcf',
            },
          },
        },
        {
          adapter: {
            fileLocation: {
              locationType: 'FileHandleLocation',
              handleId: 'fh-arr-2',
              name: 'file2.vcf',
            },
          },
        },
      ],
    }
    const result = findFileHandleIds(obj)
    expect(result.size).toBe(2)
    expect(result.has('fh-arr-1')).toBe(true)
    expect(result.has('fh-arr-2')).toBe(true)
  })

  test('ignores non-FileHandleLocation objects', () => {
    const obj = {
      uriLocation: {
        locationType: 'UriLocation',
        uri: 'https://example.com/file.bam',
      },
      blobLocation: {
        locationType: 'BlobLocation',
        blobId: 'blob123',
        name: 'local.bam',
      },
    }
    const result = findFileHandleIds(obj)
    expect(result.size).toBe(0)
  })

  test('handles circular references without infinite loop', () => {
    const obj: Record<string, unknown> = {
      location: {
        locationType: 'FileHandleLocation',
        handleId: 'fh-circular',
        name: 'circular.bam',
      },
    }
    obj.self = obj

    const result = findFileHandleIds(obj)
    expect(result.size).toBe(1)
    expect(result.has('fh-circular')).toBe(true)
  })

  test('handles deeply nested circular references', () => {
    const inner: Record<string, unknown> = {
      location: {
        locationType: 'FileHandleLocation',
        handleId: 'fh-deep',
        name: 'deep.bam',
      },
    }
    const obj = {
      level1: {
        level2: inner,
      },
    }
    inner.backRef = obj

    const result = findFileHandleIds(obj)
    expect(result.size).toBe(1)
    expect(result.has('fh-deep')).toBe(true)
  })

  test('returns empty set for null/undefined', () => {
    expect(findFileHandleIds(null).size).toBe(0)
    expect(findFileHandleIds(undefined).size).toBe(0)
  })

  test('returns empty set for primitives', () => {
    expect(findFileHandleIds('string').size).toBe(0)
    expect(findFileHandleIds(123).size).toBe(0)
    expect(findFileHandleIds(true).size).toBe(0)
  })

  test('deduplicates same handleId appearing multiple times', () => {
    const sharedLocation = {
      locationType: 'FileHandleLocation',
      handleId: 'fh-shared',
      name: 'shared.bam',
    }
    const obj = {
      loc1: sharedLocation,
      loc2: sharedLocation,
      nested: { loc3: sharedLocation },
    }
    const result = findFileHandleIds(obj)
    expect(result.size).toBe(1)
    expect(result.has('fh-shared')).toBe(true)
  })
})

describe('getFileName', () => {
  test('returns name from BlobLocation', () => {
    const loc = {
      locationType: 'BlobLocation' as const,
      blobId: 'b123',
      name: 'test.bam',
    }
    expect(getFileName(loc)).toBe('test.bam')
  })

  test('returns name from FileHandleLocation', () => {
    const loc = {
      locationType: 'FileHandleLocation' as const,
      handleId: 'fh123',
      name: 'handle.bam',
    }
    expect(getFileName(loc)).toBe('handle.bam')
  })

  test('extracts filename from UriLocation', () => {
    const loc = {
      locationType: 'UriLocation' as const,
      uri: 'https://example.com/path/to/file.bam',
    }
    expect(getFileName(loc)).toBe('file.bam')
  })

  test('handles Windows backslashes in URI', () => {
    const loc = {
      locationType: 'UriLocation' as const,
      uri: String.raw`file://C:\Users\test\file.bam`,
    }
    expect(getFileName(loc)).toBe('file.bam')
  })

  test('extracts filename from LocalPathLocation', () => {
    const loc = {
      locationType: 'LocalPathLocation' as const,
      localPath: '/home/user/data.vcf',
    }
    expect(getFileName(loc)).toBe('data.vcf')
  })

  test('handles Windows paths in LocalPathLocation', () => {
    const loc = {
      locationType: 'LocalPathLocation' as const,
      localPath: String.raw`C:\Users\test\data.vcf`,
    }
    expect(getFileName(loc)).toBe('data.vcf')
  })

  test('returns empty string for unknown location type', () => {
    const loc = { locationType: 'UnknownLocation' } as any
    expect(getFileName(loc)).toBe('')
  })
})

describe('getTrackName', () => {
  const session = { assemblies: [] }

  test('returns the name when set', () => {
    const conf = { name: 'My track', type: 'FeatureTrack', trackId: 'genes' }
    expect(getTrackName(conf, session)).toBe('My track')
  })

  test('falls back to trackId when name is empty', () => {
    const conf = { name: '', type: 'FeatureTrack', trackId: 'genes' }
    expect(getTrackName(conf, session)).toBe('genes')
  })

  test('falls back to trackId when name is unset', () => {
    const conf = { type: 'FeatureTrack', trackId: 'genes' }
    expect(getTrackName(conf, session)).toBe('genes')
  })

  test('returns empty string when neither name nor trackId set', () => {
    const conf = { type: 'FeatureTrack' }
    expect(getTrackName(conf, session)).toBe('')
  })

  test('uses generic reference sequence label when no assembly matches', () => {
    const conf = { type: 'ReferenceSequenceTrack', trackId: 'hg38-ref' }
    expect(getTrackName(conf, session)).toBe('Reference sequence')
  })
})

describe('stripFileExtension', () => {
  test('drops a plain extension', () => {
    expect(stripFileExtension('volvox-sorted.bam')).toBe('volvox-sorted')
  })

  test('drops the format extension along with a compression suffix', () => {
    expect(stripFileExtension('volvox.vcf.gz')).toBe('volvox')
    expect(stripFileExtension('volvox.gff3.bgz')).toBe('volvox')
  })

  test('keeps interior dots that are part of the name', () => {
    expect(stripFileExtension('volvox.sorted.bam')).toBe('volvox.sorted')
  })

  test('is case insensitive about the compression suffix', () => {
    expect(stripFileExtension('volvox.VCF.GZ')).toBe('volvox')
  })

  test('leaves a name with no extension alone', () => {
    expect(stripFileExtension('volvox')).toBe('volvox')
  })

  test('leaves a dotfile alone', () => {
    expect(stripFileExtension('.bam')).toBe('.bam')
  })

  test('handles a bare compression suffix', () => {
    expect(stripFileExtension('volvox.gz')).toBe('volvox')
  })
})

describe('getRpcSessionId', () => {
  const Leaf = types.model('Leaf', { id: types.identifier })

  test('finds an rpcSessionId on an ancestor', () => {
    const Mid = types
      .model('Mid', { leaf: Leaf })
      .volatile(() => ({ rpcSessionId: 'mid-session' }))
    const Root = types.model('Root', { mid: Mid })
    const root = Root.create({ mid: { leaf: { id: 'l' } } })
    expect(getRpcSessionId(root.mid.leaf)).toBe('mid-session')
  })

  test('the highest declaring node wins, not the nearest', () => {
    const Inner = types
      .model('Inner', { leaf: Leaf })
      .volatile(() => ({ rpcSessionId: 'inner-session' }))
    const Outer = types
      .model('Outer', { inner: Inner })
      .volatile(() => ({ rpcSessionId: 'outer-session' }))
    const Root = types.model('Root', { outer: Outer })
    const root = Root.create({ outer: { inner: { leaf: { id: 'l' } } } })
    expect(getRpcSessionId(root.outer.inner.leaf)).toBe('outer-session')
  })

  // the walk used to stop *before* the root, so a tree whose only declaring
  // node was the root threw as if none existed at all
  test('reads an rpcSessionId declared on the root itself', () => {
    const Root = types
      .model('Root', { leaf: Leaf })
      .volatile(() => ({ rpcSessionId: 'root-session' }))
    const root = Root.create({ leaf: { id: 'l' } })
    expect(getRpcSessionId(root.leaf)).toBe('root-session')
  })

  test('reads an rpcSessionId on the node itself', () => {
    const Self = types
      .model('Self', {})
      .volatile(() => ({ rpcSessionId: 'self-session' }))
    expect(getRpcSessionId(Self.create({}))).toBe('self-session')
  })

  test('throws when nothing in the tree declares one', () => {
    const Root = types.model('Root', { leaf: Leaf })
    const root = Root.create({ leaf: { id: 'l' } })
    expect(() => getRpcSessionId(root.leaf)).toThrow(/rpcSessionId/)
  })
})

describe('restoreFileHandles', () => {
  function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>(r => {
      resolve = r
    })
    return { promise, resolve }
  }

  // one entry per verifyPermission call, so a test can see exactly which
  // handles have been asked about and hold each answer open
  let checks: { handleId: string; answer: (granted: boolean) => void }[]
  // resolved as the Nth check begins, so a test waits on the thing it is
  // asserting about rather than on a timer
  let checkStarted: ReturnType<typeof deferred<void>>[]

  beforeEach(() => {
    checks = []
    checkStarted = [deferred<void>(), deferred<void>(), deferred<void>()]
    ;(getFileHandle as jest.Mock).mockImplementation((handleId: string) =>
      Promise.resolve({
        name: `${handleId}.bam`,
        getFile: () => Promise.resolve(new File([], `${handleId}.bam`)),
      }),
    )
    ;(verifyPermission as jest.Mock).mockImplementation(
      (handle: { name: string }) => {
        const answer = deferred<boolean>()
        checks.push({
          handleId: handle.name.replace('.bam', ''),
          answer: answer.resolve,
        })
        checkStarted[checks.length - 1]?.resolve()
        return answer.promise
      },
    )
  })

  test('prompts for one file at a time, not all at once', async () => {
    // a browser shows one file-access prompt per user gesture, so firing them
    // concurrently means one dialog and the rest denied unasked
    const all = restoreFileHandles(['p1', 'p2', 'p3'], true)

    await checkStarted[0]!.promise
    expect(checks.map(c => c.handleId)).toEqual(['p1'])

    checks[0]!.answer(true)
    await checkStarted[1]!.promise
    expect(checks.map(c => c.handleId)).toEqual(['p1', 'p2'])

    checks[1]!.answer(true)
    await checkStarted[2]!.promise
    checks[2]!.answer(true)

    expect((await all).map(r => r.success)).toEqual([true, true, true])
  })

  test('a denial does not stop the files behind it being offered', async () => {
    const all = restoreFileHandles(['d1', 'd2'], true)

    await checkStarted[0]!.promise
    checks[0]!.answer(false)
    await checkStarted[1]!.promise
    checks[1]!.answer(true)

    expect((await all).map(r => r.success)).toEqual([false, true])
  })

  test('runs the batch at once when it cannot prompt', async () => {
    // nothing to take turns over, and this is the session-load path
    const all = restoreFileHandles(['s1', 's2', 's3'], false)

    // all three in flight before any has been answered — serializing this would
    // deadlock here rather than pass slowly
    await Promise.all(checkStarted.map(d => d.promise))
    expect(checks.map(c => c.handleId)).toEqual(['s1', 's2', 's3'])

    for (const check of checks) {
      check.answer(true)
    }
    expect((await all).map(r => r.success)).toEqual([true, true, true])
  })
})

describe('confAssemblyNames', () => {
  // A ReferenceSequenceTrack's schema deliberately omits `assemblyNames`: the
  // assembly config holding it IS its assembly. That makes the answer
  // positional, and every hydration path — `hydrateTrackConfig`, and the
  // working copy a non-admin's edits would go to (ADR-032) — produces a config
  // with no position.
  const SequenceConfig = ConfigurationSchema(
    'TestSequenceTrack',
    { sequenceType: { type: 'string', defaultValue: 'dna' } },
    { explicitIdentifier: 'trackId', explicitlyTyped: true },
  )
  const AssemblyConfig = ConfigurationSchema('TestAssembly', {
    name: { type: 'string', defaultValue: '' },
    sequence: SequenceConfig,
  })

  test('reads the name off the containing assembly', () => {
    const assembly = AssemblyConfig.create({
      name: 'volvox',
      sequence: { trackId: 'volvox_refseq' },
    })
    expect(getConfAssemblyNames(assembly.sequence)).toEqual(['volvox'])
    expect(getConfAssemblyNamesOrNone(assembly.sequence)).toEqual(['volvox'])
  })

  test('a detached copy answers unknown rather than raising MST', () => {
    const detached = SequenceConfig.create({ trackId: 'volvox_refseq' })
    // the whole contract of the OrNone reader: its caller is
    // `BaseTrackModel.refNameMismatch`, on every render of every track label
    expect(getConfAssemblyNamesOrNone(detached)).toEqual([])
    expect(() => getConfAssemblyNames(detached)).toThrow(
      'unknown assembly names',
    )
  })
})
