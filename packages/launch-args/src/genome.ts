const HOST = 'https://jbrowse.org'

const GENARK_ACCESSION = /^(GC[AF])_(\d{3})(\d{3})(\d{3})/

export function isGenArkAccession(genome: string) {
  return GENARK_ACCESSION.test(genome)
}

/**
 * The config.json genomes.jbrowse.org hosts for a genome: a UCSC database name
 * (`hg38`) or a GenArk accession (`GCA_964188535.1`). A copy of `hubUrl` in
 * `@jbrowse/core/util/fetchHub`, so this package needs no core;
 * `genome.test.ts` holds the two together.
 */
export function genomeConfigUrl(genome: string) {
  const genark = GENARK_ACCESSION.exec(genome)
  return genark
    ? `${HOST}/hubs/genark/${genark[1]}/${genark[2]}/${genark[3]}/${genark[4]}/${genome}/config.json`
    : `${HOST}/ucsc/${genome}/config.json`
}
