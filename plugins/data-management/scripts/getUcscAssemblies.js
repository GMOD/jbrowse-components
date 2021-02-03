#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * This grabs the UCSC genome downloads page and parses it for assembly names.
 * It then checks each assembly name to see if there is a 2bit file for it at
 * the expected URL. Finally, it prints a list of assemblies names that have
 * 2bit files, one name per line.
 */

const http = require('http')

const listGenomesEndpoint = 'http://api.genome.ucsc.edu/list/ucscGenomes'

http
  .get(listGenomesEndpoint, res => {
    const { statusCode } = res
    if (statusCode !== 200)
      throw new Error(
        `Could not list genomes from API, status code ${statusCode}: ${listGenomesEndpoint}`,
      )
    res.setEncoding('utf8')
    let pageContent = ''
    res.on('data', chunk => {
      pageContent += chunk
    })
    res.on('end', () => {
      parseGenomes(pageContent)
    })
  })
  .on('error', e => {
    console.error(`problem with request: ${e.message}`)
  })

function parseGenomes(pageContent) {
  const response = JSON.parse(pageContent)
  const assemblyNames = Array.from(Object.keys(response.ucscGenomes))
  checkAssembliesFor2bit(assemblyNames, [])
}

function checkAssembliesFor2bit(uncheckedAssemblies, checkedAssemblies) {
  if (!uncheckedAssemblies.length) {
    checkedAssemblies.sort()
    checkedAssemblies.forEach(assemblyName => console.log(assemblyName))
    return
  }
  const [assemblyName] = uncheckedAssemblies
  http
    .request(
      `http://hgdownload.soe.ucsc.edu/gbdb/${assemblyName}/${assemblyName}.2bit`,
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
