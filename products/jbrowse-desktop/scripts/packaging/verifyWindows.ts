import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'

import {
  auditSignature,
  signatureBlob,
  signerCertificate,
} from './authenticode.ts'
import { WINDOWS_PUBLISHER_NAMES } from './config.ts'
import { log } from './utils.ts'

import type { Certificate } from './authenticode.ts'

const PEM = /-----BEGIN CERTIFICATE-----[^-]+-----END CERTIFICATE-----/g

function openssl(args: string[], input: string | Buffer) {
  const result = spawnSync('openssl', args, {
    input,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  })
  if (result.status !== 0) {
    throw new Error(`openssl ${args.join(' ')} failed: ${result.stderr}`)
  }
  return result.stdout
}

function readChain(pkcs7: Buffer): Certificate[] {
  const chain = openssl(['pkcs7', '-inform', 'DER', '-print_certs'], pkcs7)
  return [...chain.matchAll(PEM)].map(([pem]) => {
    const fields = openssl(
      ['x509', '-noout', '-subject', '-issuer', '-enddate'],
      pem,
    )
    const read = (name: string) =>
      new RegExp(`^${name}=(.*)$`, 'm').exec(fields)?.[1]?.trim() ?? ''
    return {
      subject: read('subject'),
      issuer: read('issuer'),
      notAfter: read('notAfter'),
    }
  })
}

/**
 * Fails the build if what came back from signing is not what app-update.yml
 * tells clients to expect.
 *
 * verifyMacCodesign exists after an expired identity shipped three releases of
 * an unsigned app without saying so; Windows had only CodeSignTool's exit code,
 * and now has a signing request whose artifact the runner unpacks over the file
 * it sent. The publisher name is compared on the user's machine and nowhere
 * else, so a certificate under an unlisted subject would refuse every Windows
 * update, and the first report would be a user who cannot upgrade.
 *
 * buildWindows calls this only in the phases that resume after a signing
 * request, so a local `package:win` is unaffected.
 */
export function verifyWindowsSignature(filePath: string) {
  const name = path.basename(filePath)
  const blob = signatureBlob(fs.readFileSync(filePath))
  const signer = blob && signerCertificate(readChain(blob))
  log(
    signer
      ? `${name} is signed by ${signer.commonName}`
      : `${name} is unsigned`,
  )
  const problems = auditSignature({
    signer,
    publisherNames: WINDOWS_PUBLISHER_NAMES,
    now: new Date(),
  })
  if (problems.length > 0) {
    throw new Error(`${name} cannot ship: ${problems.join('; ')}`)
  }
}
