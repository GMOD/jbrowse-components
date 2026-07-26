import { describe, expect, it } from 'vitest'

import {
  BLAT_ROUTE,
  ISPCR_ROUTE,
  MAX_PRIMER_LENGTH,
  routeForPath,
} from '../src/routes.ts'

const PRIMERS = 'db=hg38&wp_f=ACCTGCAGGTTCAGAGTTCT&wp_r=CTGGGCAACAGAGCGAGAC'

describe('routeForPath', () => {
  // API Gateway hands the Lambda a stage-prefixed path while the configured
  // routeKey has none, so the match is on the last segment
  it('resolves a stage-prefixed deployed path', () => {
    expect(routeForPath('/prod/ispcr')).toBe(ISPCR_ROUTE)
    expect(routeForPath('/prod/blat')).toBe(BLAT_ROUTE)
  })

  it('resolves an unprefixed local path', () => {
    expect(routeForPath('/ispcr')).toBe(ISPCR_ROUTE)
  })

  it('has no route for an unknown path', () => {
    expect(routeForPath('/prod/hgTables')).toBeUndefined()
  })
})

describe('ISPCR_ROUTE.buildBody', () => {
  it('injects the apiKey and leaves the primer parameters alone', () => {
    const params = new URLSearchParams(ISPCR_ROUTE.buildBody(PRIMERS, 'SECRET'))
    expect(params.get('apiKey')).toBe('SECRET')
    expect(params.get('wp_f')).toBe('ACCTGCAGGTTCAGAGTTCT')
    expect(params.get('wp_r')).toBe('CTGGGCAACAGAGCGAGAC')
  })

  // hgPcr has no JSON mode; asking for one gets an error page, not a result
  it('does not force output=json the way the blat route does', () => {
    expect(
      new URLSearchParams(ISPCR_ROUTE.buildBody(PRIMERS, 'K')).get('output'),
    ).toBeNull()
    expect(
      new URLSearchParams(BLAT_ROUTE.buildBody('userSeq=ACGT', 'K')).get(
        'output',
      ),
    ).toBe('json')
  })

  it('overwrites a client-supplied apiKey', () => {
    const body = ISPCR_ROUTE.buildBody(`${PRIMERS}&apiKey=CLIENT`, 'SERVER')
    expect(new URLSearchParams(body).get('apiKey')).toBe('SERVER')
  })
})

describe('ISPCR_ROUTE.validate', () => {
  it('accepts a primer pair', () => {
    expect(ISPCR_ROUTE.validate(PRIMERS)).toBeUndefined()
  })

  it('rejects a half-specified or empty pair before spending a slot', () => {
    expect(ISPCR_ROUTE.validate('db=hg38&wp_f=ACCTGCAGG')).toMatch(/wp_f\/wp_r/)
    expect(ISPCR_ROUTE.validate('db=hg38&wp_f=&wp_r=CTGGG')).toMatch(
      /wp_f\/wp_r/,
    )
    expect(ISPCR_ROUTE.validate('db=hg38')).toMatch(/wp_f\/wp_r/)
  })

  it('rejects something that is not a primer', () => {
    const body = `db=hg38&wp_f=${'A'.repeat(MAX_PRIMER_LENGTH + 1)}&wp_r=CTGGG`
    expect(ISPCR_ROUTE.validate(body)).toMatch(/primer too large/)
  })
})

describe('ISPCR_ROUTE.rejectReason', () => {
  // hgPcr's success IS an HTML page, so unlike the blat route it cannot treat
  // markup as failure
  it('accepts the HTML page that carries the amplicons', () => {
    expect(
      ISPCR_ROUTE.rejectReason('<HTML><PRE>&gt;chr7:1+300 300bp AC GT</PRE>'),
    ).toBeUndefined()
  })

  // the honest "no products" answer, which a bare /captcha/ marker used to
  // misread as a CAPTCHA wall because every UCSC page's CSP whitelists
  // www.google.com/recaptcha/api.js
  it('accepts a no-matches page, CSP recaptcha mention and all', () => {
    const page =
      '<HTML><head><meta http-equiv="Content-Security-Policy" ' +
      'content="script-src www.google.com/recaptcha/api.js">' +
      '</head><body>No matches</body></HTML>'
    expect(ISPCR_ROUTE.rejectReason(page)).toBeUndefined()
    // and the blat route still refuses it, since there HTML is never a result
    expect(BLAT_ROUTE.rejectReason(page)).toMatch(/HTML/)
  })

  it('refuses an actual Cloudflare challenge', () => {
    expect(
      ISPCR_ROUTE.rejectReason('<html><script>window.turnstile</script>'),
    ).toMatch(/CAPTCHA challenge/)
    expect(
      ISPCR_ROUTE.rejectReason('<html><div id="cf-chl-widget"></div>'),
    ).toMatch(/CAPTCHA challenge/)
  })
})
