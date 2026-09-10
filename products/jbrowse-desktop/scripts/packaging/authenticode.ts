// Reading back the Authenticode signature of an exe that was just signed. Its
// own module, taking a Buffer, for the reason artifacts.ts gives about config.ts
// and `import.meta.dirname`.

export interface CertificateTable {
  offset: number
  size: number
}

/**
 * Where an exe carries its signature, or undefined when it carries none.
 *
 * The offset in the data directory is absolute, unlike every other entry: the
 * certificate table is the one that lives outside every section, so the usual
 * RVA walk would silently read somewhere else.
 */
export function certificateTable(exe: Buffer): CertificateTable | undefined {
  if (exe.length < 0x40 || exe.toString('ascii', 0, 2) !== 'MZ') {
    throw new Error('not a PE image: no MZ signature')
  }
  const pe = exe.readUInt32LE(0x3c)
  if (exe.length < pe + 24 || exe.toString('ascii', pe, pe + 4) !== 'PE\0\0') {
    throw new Error('not a PE image: no PE signature')
  }
  const optional = pe + 24
  const pe32Plus = exe.readUInt16LE(optional) === 0x20b
  const security = optional + (pe32Plus ? 112 : 96) + 4 * 8
  if (exe.length < security + 8) {
    throw new Error('PE header is truncated before the certificate table')
  }
  const offset = exe.readUInt32LE(security)
  const size = exe.readUInt32LE(security + 4)
  return offset === 0 || size === 0 ? undefined : { offset, size }
}

// dwLength, wRevision, wCertificateType, then the PKCS#7
const WIN_CERTIFICATE_HEADER = 8

/** The PKCS#7 SignedData, ready for `openssl pkcs7 -inform DER`. */
export function signatureBlob(exe: Buffer) {
  const table = certificateTable(exe)
  if (!table) {
    return undefined
  }
  const end = table.offset + table.size
  if (end > exe.length) {
    throw new Error(
      `the certificate table runs to ${end}, past the end of a ${exe.length} byte file`,
    )
  }
  return exe.subarray(table.offset + WIN_CERTIFICATE_HEADER, end)
}

export interface Certificate {
  subject: string
  issuer: string
  notAfter: string
}

export interface Signer {
  commonName: string
  expires: Date
}

/**
 * The signing certificate, picked out of a chain by being the one nothing else
 * issued. Taking the first or the last gets a root on some chains.
 */
export function signerCertificate(certificates: Certificate[]): Signer {
  const issuers = new Set(certificates.map(c => c.issuer))
  const leaf = certificates.find(c => !issuers.has(c.subject))
  if (!leaf) {
    throw new Error('every certificate in the chain issued another one')
  }
  const commonName = /(?:^|,)\s*CN\s*=\s*([^,]+)/.exec(leaf.subject)?.[1]
  if (!commonName) {
    throw new Error(`the signing certificate has no CN: ${leaf.subject}`)
  }
  return { commonName: commonName.trim(), expires: new Date(leaf.notAfter) }
}

/**
 * Everything wrong with a signature, as sentences. Empty means it can ship.
 * `now` is a parameter so the expiry is testable without waiting for 2027.
 */
export function auditSignature({
  signer,
  publisherName,
  now,
}: {
  signer: Signer | undefined
  publisherName: string
  now: Date
}) {
  if (!signer) {
    return ['it carries no Authenticode signature at all']
  }
  const problems: string[] = []
  if (signer.commonName !== publisherName) {
    problems.push(
      `it is signed by "${signer.commonName}", but app-update.yml tells every client to expect "${publisherName}", so Windows updates would be refused`,
    )
  }
  if (signer.expires <= now) {
    problems.push(
      `the signing certificate expired on ${signer.expires.toISOString().slice(0, 10)}`,
    )
  }
  return problems
}
