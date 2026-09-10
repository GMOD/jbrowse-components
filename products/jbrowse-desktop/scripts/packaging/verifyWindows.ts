import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'

import {
  auditSignature,
  signatureBlob,
  signerCertificate,
} from './authenticode.ts'
import { WINDOWS_PUBLISHER_NAME } from './config.ts'
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
 * Fails the build if what was just signed is not what app-update.yml tells
 * clients to expect.
 *
 * verifyMacCodesign exists after an expired identity shipped three releases of
 * an unsigned app without saying so; Windows had only CodeSignTool's exit code.
 * The publisher name is compared on the user's machine and nowhere else, so a
 * certificate reissued under a different subject would refuse every Windows
 * update, and the first report would be a user who cannot upgrade.
 *
 * Runs only where signing did, so a local `package:win` is unaffected.
 */
export function verifyWindowsSignature(filePath: string) {
  const name = path.basename(filePath)
  if (!process.env.WINDOWS_SIGN_CREDENTIAL_ID) {
    log(`Skipping signature verify for ${name} (unsigned build)`)
    return
  }
  log(`Verifying the signature on ${name}...`)
  const blob = signatureBlob(fs.readFileSync(filePath))
  const problems = auditSignature({
    signer: blob && signerCertificate(readChain(blob)),
    publisherName: WINDOWS_PUBLISHER_NAME,
    now: new Date(),
  })
  if (problems.length > 0) {
    throw new Error(`${name} cannot ship: ${problems.join('; ')}`)
  }
  log(`Signed by ${WINDOWS_PUBLISHER_NAME}`)
}
