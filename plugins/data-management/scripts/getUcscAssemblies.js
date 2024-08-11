#!/usr/bin/env node

/**
 * This grabs the UCSC genome downloads page and parses it for assembly names.
 * It then checks each assembly name to see if there is a 2bit file for it at
 * the expected URL. Finally, it prints a list of assemblies names that have
 * 2bit files, one name per line.
 */

const http = require('http')

const downloadsPageUrl = 'http://hgdownload.soe.ucsc.edu/downloads.html'

http
  .get(downloadsPageUrl, res => {
    const { statusCode } = res
    if (statusCode !== 200) {
      throw new Error(
        `Could not get downloads page, status code ${statusCode}: ${downloadsPageUrl}`,
      )
    }
    res.setEncoding('utf8')
    let pageContent = ''
    res.on('data', chunk => {
      pageContent += chunk
    })
    res.on('end', () => {
      parseDownloadsPageContent(pageContent)
    })
  })
  .on('error', e => {
    console.error(`problem with request: ${e.message}`)
  })

function parseDownloadsPageContent(pageContent) {
  const assemblyNames = pageContent.match(/(?<=goldenPath\/)\w+(?=\/bigZips)/g)
  checkAssembliesFor2bit(assemblyNames, [])
}

function checkAssembliesFor2bit(uncheckedAssemblies, checkedAssemblies) {
  if (!uncheckedAssemblies.length) {
    checkedAssemblies.sort()
    checkedAssemblies.forEach(assemblyName => {
      console.log(assemblyName)
    })
    return
  }
  const [assemblyName] = uncheckedAssemblies
  http
    .request(
      `http://hgdownload.soe.ucsc.edu/goldenPath/${assemblyName}/bigZips/${assemblyName}.2bit`,
      { method: 'HEAD' },
      res => {
        const { statusCode } = res
        if (statusCode !== 200) {
          checkAssembliesFor2bit(
            uncheckedAssemblies.slice(1),
            checkedAssemblies,
          )
          return
        }
        checkAssembliesFor2bit(
          uncheckedAssemblies.slice(1),
          checkedAssemblies.concat([assemblyName]),
        )
      },
    )
    .on('error', e => {
      console.error(`problem with request: ${e.message}`)
    })
    .end()
}
