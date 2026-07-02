import { describe, expect, it } from 'vitest'

import { buildUpstreamBody, looksLikeHtml } from '../src/proxy.ts'

describe('buildUpstreamBody', () => {
  it('injects the server apiKey and forces json output', () => {
    const body = buildUpstreamBody('userSeq=ACGT&type=DNA&db=hg38', 'SECRET')
    const params = new URLSearchParams(body)
    expect(params.get('userSeq')).toBe('ACGT')
    expect(params.get('db')).toBe('hg38')
    expect(params.get('apiKey')).toBe('SECRET')
    expect(params.get('output')).toBe('json')
  })

  it('overwrites a client-supplied apiKey with the server one', () => {
    const body = buildUpstreamBody('db=hg38&apiKey=CLIENT', 'SERVER')
    expect(new URLSearchParams(body).get('apiKey')).toBe('SERVER')
  })

  it('preserves an existing output=json without duplicating it', () => {
    const body = buildUpstreamBody('db=hg38&output=json', 'K')
    expect(new URLSearchParams(body).getAll('output')).toEqual(['json'])
  })
})

describe('looksLikeHtml', () => {
  it('detects a leading tag after whitespace', () => {
    expect(looksLikeHtml('\n  <!DOCTYPE html>')).toBe(true)
    expect(looksLikeHtml('<html><body>challenge</body></html>')).toBe(true)
  })

  it('treats JSON as not-HTML', () => {
    expect(looksLikeHtml('{"blat":[]}')).toBe(false)
    expect(looksLikeHtml('  {"fields":[]}')).toBe(false)
  })
})
