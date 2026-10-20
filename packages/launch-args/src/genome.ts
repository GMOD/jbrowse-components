const HOST = 'https://jbrowse.org'

/**
 * The config.json genomes.jbrowse.org hosts for a genome: a UCSC database name
 * (`hg38`) or a GenArk accession (`GCA_964188535.1`). A copy of `hubUrl` in
 * `@jbrowse/core/util/fetchHub`, so this package needs no core;
 * `genome.test.ts` holds the two together.
 */
export function genomeConfigUrl(genome: string) {
  const genark = /^(GC[AF])_(\d{3})(\d{3})(\d{3})/.exec(genome)
  return genark
    ? `${HOST}/hubs/genark/${genark[1]}/${genark[2]}/${genark[3]}/${genark[4]}/${genome}/config.json`
    : `${HOST}/ucsc/${genome}/config.json`
}
