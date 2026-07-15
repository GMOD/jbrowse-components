import { openTabixIndexFilehandle } from './index.ts'

describe('openTabixIndexFilehandle', () => {
  const location = {
    localPath: '/path/to/file.gz.tbi',
    locationType: 'LocalPathLocation' as const,
  }

  it('routes CSI to csiFilehandle only', () => {
    const r = openTabixIndexFilehandle(location, 'CSI')
    expect('csiFilehandle' in r).toBe(true)
    expect('tbiFilehandle' in r).toBe(false)
  })

  it('routes TBI to tbiFilehandle only', () => {
    const r = openTabixIndexFilehandle(location, 'TBI')
    expect('tbiFilehandle' in r).toBe(true)
    expect('csiFilehandle' in r).toBe(false)
  })

  it('defaults non-CSI (including undefined) to tbiFilehandle', () => {
    const r = openTabixIndexFilehandle(location, undefined)
    expect('tbiFilehandle' in r).toBe(true)
    expect('csiFilehandle' in r).toBe(false)
  })
})
