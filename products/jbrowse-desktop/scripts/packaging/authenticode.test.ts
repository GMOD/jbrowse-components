import {
  auditSignature,
  certificateTable,
  signatureBlob,
  signerCertificate,
} from './authenticode.ts'

// Just enough PE to place a certificate table: the arithmetic is the part that
// silently reads the wrong bytes rather than failing.
function fakeExe({
  pe32Plus = false,
  offset = 0,
  size = 0,
  trailing = 0,
} = {}) {
  const peAt = 0x100
  const optional = peAt + 24
  const security = optional + (pe32Plus ? 112 : 96) + 4 * 8
  const exe = Buffer.alloc(Math.max(security + 8, offset + size) + trailing)
  exe.write('MZ', 0, 'ascii')
  exe.writeUInt32LE(peAt, 0x3c)
  exe.write('PE\0\0', peAt, 'ascii')
  exe.writeUInt16LE(pe32Plus ? 0x20b : 0x10b, optional)
  exe.writeUInt32LE(offset, security)
  exe.writeUInt32LE(size, security + 4)
  return exe
}

test('the table is found in both PE flavours', () => {
  expect(certificateTable(fakeExe({ offset: 900, size: 64 }))).toEqual({
    offset: 900,
    size: 64,
  })
  expect(
    certificateTable(fakeExe({ pe32Plus: true, offset: 900, size: 64 })),
  ).toEqual({ offset: 900, size: 64 })
})

// PE32+ moves the data directories 16 bytes further in. Reading a PE32+ image at
// the PE32 offset lands on the certificate table's neighbours and returns a
// plausible offset into the middle of the file.
test('the two flavours do not read each other’s directories', () => {
  const plus = fakeExe({ pe32Plus: true, offset: 900, size: 64 })
  plus.writeUInt32LE(0x0badf00d, 0x100 + 24 + 96 + 4 * 8)
  expect(certificateTable(plus)).toEqual({ offset: 900, size: 64 })
})

test('an unsigned exe reports no table rather than a zero one', () => {
  expect(certificateTable(fakeExe())).toBeUndefined()
  expect(signatureBlob(fakeExe())).toBeUndefined()
})

test('a file that is not a PE says so', () => {
  expect(() => certificateTable(Buffer.alloc(1024))).toThrow(/no MZ/)
})

// The blob starts past WIN_CERTIFICATE's 8-byte header; handing openssl those
// eight bytes makes it reject a signature that is perfectly good.
test('the blob skips the WIN_CERTIFICATE header', () => {
  const exe = fakeExe({ offset: 1024, size: 24 })
  Buffer.from('12345678DERDERDERDERDERD').copy(exe, 1024)
  expect(signatureBlob(exe)?.toString()).toBe('DERDERDERDERDERD')
})

test('a table running past the end of the file is refused', () => {
  const exe = fakeExe({ offset: 1024, size: 24 })
  expect(() => signatureBlob(exe.subarray(0, 1030))).toThrow(/past the end/)
})

const root = { subject: 'CN=Root', issuer: 'CN=Root', notAfter: 'Jan 1 2030' }
const intermediate = {
  subject: 'CN=Intermediate',
  issuer: 'CN=Root',
  notAfter: 'Jan 1 2029',
}
const leaf = {
  subject:
    'C=US, ST=California, L=Berkeley, O=Evolutionary Software Foundation, CN=Evolutionary Software Foundation',
  issuer: 'CN=Intermediate',
  notAfter: 'Jul 10 14:41:22 2027 GMT',
}

// The chain arrives root-first from openssl, so first-or-last picks a CA.
test('the signer is the certificate nothing else issued', () => {
  expect(signerCertificate([root, intermediate, leaf]).commonName).toBe(
    'Evolutionary Software Foundation',
  )
  expect(signerCertificate([leaf, root, intermediate]).commonName).toBe(
    'Evolutionary Software Foundation',
  )
})

const signer = signerCertificate([root, intermediate, leaf])
const publisherName = 'Evolutionary Software Foundation'
const before = new Date('2026-09-10')

test('a current certificate under the expected name is fine', () => {
  expect(auditSignature({ signer, publisherName, now: before })).toEqual([])
})

// app-update.yml carries publisherName to every client, and a mismatch is
// checked there and nowhere else — so it refuses every Windows update.
test('a certificate under another name is caught here', () => {
  expect(
    auditSignature({ signer, publisherName: 'Someone Else', now: before }),
  ).toEqual([expect.stringContaining('Windows updates would be refused')])
})

// The mac identity expired once and three releases shipped unsigned without
// saying so.
test('an expired certificate is caught here', () => {
  expect(
    auditSignature({ signer, publisherName, now: new Date('2028-01-01') }),
  ).toEqual([expect.stringContaining('expired on 2027-07-10')])
})

test('an unsigned file is a problem on its own', () => {
  expect(
    auditSignature({ signer: undefined, publisherName, now: before }),
  ).toEqual(['it carries no Authenticode signature at all'])
})
