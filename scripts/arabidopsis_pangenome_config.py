#!/usr/bin/env python3
"""config.json for the 1001G+ Arabidopsis pangenome demo, from what is built.

Run in the directory build_arabidopsis_pangenome.sh writes: reads
accessions.tsv (id, name, country, admixture group), takes the accessions whose
SyRI pair exists, and points every per-accession annotation and epigenome
track at the 1001 Genomes data centre itself. The graph tracks appear once the
minigraph projections are beside the config.

The files it wrote are named relative to the config. --base-url <prefix>
writes them as absolute URLs instead, for a config hosted somewhere else, such
as GMOD/jb2hubs' pangenome page.
"""

import json
import os
import sys
import urllib.request

BASE = sys.argv[sys.argv.index('--base-url') + 1].rstrip('/') + '/' if '--base-url' in sys.argv else ''

PORTAL = 'https://1001genomes.org/data/1001Gp/27genomes/releases/current'
GENARK = 'https://hgdownload.soe.ucsc.edu/hubs/GCF/000/001/735/GCF_000001735.4/bbi/GCF_000001735.4_TAIR10.1'
EVA = 'https://ftp.ebi.ac.uk/pub/databases/eva'
GRAPH = 'arabidopsis-tair10-minigraph'
PANSN = {'assemblyNameToPanSN': {'TAIR10': 'TAIR10'}}
SYRI_TYPES = ['SYN', 'INV', 'TRANS', 'INVTR', 'DUP', 'INVDP']
# the portal's gene annotation of 85-3 is named after its corrected assembly
GENE_FILE_ID = {'22001': '22001f'}


def exists(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, method='HEAD'), timeout=20) as r:
            return r.status == 200
    except Exception:
        return False


def accessions():
    rows = []
    with open('accessions.tsv') as fh:
        for line in fh:
            acc_id, name, country, group = line.rstrip('\n').split('\t')
            if os.path.exists(f'TAIR10_{name}.paf'):
                rows.append({'id': acc_id, 'name': name, 'country': country, 'group': group})
    return rows


def assembly(name, display, sequence_adapter, aliases, names_also=()):
    return {
        'name': name,
        'displayName': display,
        **({'aliases': list(names_also)} if names_also else {}),
        'sequence': {
            'type': 'ReferenceSequenceTrack',
            'trackId': f'{name}-ReferenceSequenceTrack',
            'adapter': sequence_adapter,
        },
        'refNameAliases': {'uri': aliases},
    }


def multi_wiggle(track_id, name, assembly_name, parts):
    return {
        'type': 'MultiQuantitativeTrack',
        'trackId': track_id,
        'name': name,
        'assemblyNames': [assembly_name],
        'adapter': {
            'type': 'MultiWiggleAdapter',
            'subadapters': [
                {'type': 'BigWigAdapter', 'name': label, 'bigWigLocation': {'uri': uri}} for label, uri in parts
            ],
        },
    }


def per_accession_tracks(row):
    name, acc_id = row['name'], row['id']
    label = f'{name} ({acc_id})'
    tracks = []
    genes = f'{PORTAL}/annotations/genes_v05_{GENE_FILE_ID.get(acc_id, acc_id)}.gff.gz'
    if exists(genes + '.tbi'):
        tracks.append(
            {
                'type': 'FeatureTrack',
                'trackId': f'{name}_genes',
                'name': f'{label} genes',
                'assemblyNames': [name],
                'adapter': {'type': 'Gff3TabixAdapter', 'uri': genes},
            }
        )
    else:
        print(f'no gene annotation for {name}: {genes}')
    te = f'{PORTAL}/TEs/{acc_id}.scaffolds_corrected.with_unplaced.v2.1.fasta.mod.EDTA.TEanno.gff3.gz'
    if exists(te + '.tbi'):
        tracks.append(
            {
                'type': 'FeatureTrack',
                'trackId': f'{name}_TEs',
                'name': f'{label} transposable elements (EDTA)',
                'assemblyNames': [name],
                'adapter': {'type': 'Gff3TabixAdapter', 'uri': te},
            }
        )
    if exists(f'{PORTAL}/methylation/{acc_id}.CGmeth.bw'):
        tracks.append(
            multi_wiggle(
                f'{name}_methylation',
                f'{label} methylation (CG, CHG, CHH)',
                name,
                [(ctx, f'{PORTAL}/methylation/{acc_id}.{ctx}meth.bw') for ctx in ('CG', 'CHG', 'CHH')],
            )
        )
    if exists(f'{PORTAL}/chip-seq/{acc_id}.rep1.H3K27me3.log2.input_norm.bw'):
        tracks.append(
            multi_wiggle(
                f'{name}_chipseq',
                f'{label} histone ChIP-seq, log2 over input (rep1)',
                name,
                [
                    (mark, f'{PORTAL}/chip-seq/{acc_id}.rep1.{mark}.log2.input_norm.bw')
                    for mark in ('H3K4me3', 'H3K36me3', 'H3K27me3', 'H3K9me2', 'H1')
                ],
            )
        )
    return tracks


def graph_tracks(names):
    if not os.path.exists(f'{GRAPH}.segs.bed.gz'):
        return []
    tracks = [
        {
            'type': 'FeatureTrack',
            'trackId': 'arabidopsis_minigraph_segments',
            'name': '1001G+ minigraph pangenome (rGFA segments)',
            'assemblyNames': ['TAIR10'],
            'adapter': {'type': 'RgfaTabixAdapter', 'uri': GRAPH, **PANSN},
            'displayDefaults': {'color': "jexl:get(feature,'rank')==0?'rgb(52,152,219)':'rgb(237,137,44)'"},
        },
        {
            'type': 'FeatureTrack',
            'trackId': 'arabidopsis_minigraph_tier',
            'name': '1001G+ minigraph pangenome: bubble tier (one node per bubble)',
            'assemblyNames': ['TAIR10'],
            'adapter': {'type': 'RgfaTabixAdapter', 'uri': f'{GRAPH}.tier10000', **PANSN},
        },
        {
            'type': 'FeatureTrack',
            'trackId': 'arabidopsis_minigraph_bubbles',
            'name': '1001G+ minigraph pangenome bubbles',
            'assemblyNames': ['TAIR10'],
            'adapter': {'type': 'MinigraphBubbleAdapter', 'uri': f'{GRAPH}.bubbles.bed.gz', **PANSN},
            'displayDefaults': {'color': 'rgb(130,130,130)'},
        },
        {
            'type': 'QuantitativeTrack',
            'trackId': 'arabidopsis_bubble_score',
            'name': '1001G+ minigraph pangenome: variability (segments per bubble)',
            'assemblyNames': ['TAIR10'],
            'adapter': {'type': 'MinigraphBubbleAdapter', 'uri': f'{GRAPH}.bubbles.bed.gz', **PANSN},
        },
        {
            'type': 'AlignmentsTrack',
            'trackId': 'arabidopsis_minigraph_alleles',
            'name': '1001G+ minigraph pangenome: allele inventory',
            'assemblyNames': ['TAIR10'],
            'adapter': {'type': 'BedTabixAdapter', 'uri': f'{GRAPH}.alleles.bed.gz'},
        },
    ]
    if os.path.exists(f'{GRAPH}.paths.bed.gz'):
        tracks.append(
            {
                'type': 'FeatureTrack',
                'trackId': 'arabidopsis_minigraph_paths',
                'name': "1001G+ minigraph pangenome: each accession's allele at every bubble",
                'assemblyNames': ['TAIR10'],
                'adapter': {'type': 'BedTabixAdapter', 'uri': f'{GRAPH}.paths.bed.gz', 'disableGeneHeuristic': True},
                'displays': [
                    {
                        'type': 'LinearMultiRowFeatureDisplay',
                        'displayId': 'arabidopsis_minigraph_paths-LinearMultiRowFeatureDisplay',
                        'rows': {'field': 'strain', 'domain': names},
                    }
                ],
            }
        )
    return tracks


def absolutize(node):
    if isinstance(node, dict):
        return {
            k: BASE + v if k == 'uri' and isinstance(v, str) and '://' not in v else absolutize(v)
            for k, v in node.items()
        }
    if isinstance(node, list):
        return [absolutize(v) for v in node]
    return node


def main():
    rows = accessions()
    names = [r['name'] for r in rows]
    config = {
        '$schema': 'https://jbrowse.org/jb2/schema/v5/config.json',
        'plugins': [
            {
                'name': 'GraphGenomeView',
                'esmUrl': 'https://unpkg.com/jbrowse-plugin-graphgenomeviewer/dist/jbrowse-plugin-graphgenomeviewer.esm.js',
            }
        ],
        'assemblies': [
            assembly(
                'TAIR10',
                'TAIR10 (Col-0 reference)',
                {'type': 'BgzipFastaAdapter', 'uri': 'TAIR10.fa.gz'},
                'TAIR10.aliases.txt',
                # the hosted GenArk config's name for it, so a launch written
                # against that config opens here too
                names_also=('GCF_000001735.4', 'tair10'),
            ),
            *[
                assembly(
                    r['name'],
                    f"{r['name']} ({r['id']}, {r['country']})" if r['country'] else f"{r['name']} ({r['id']})",
                    {'type': 'ChromSizesAdapter', 'uri': f"{r['name']}.chrom.sizes"},
                    f"{r['name']}.aliases.txt",
                )
                for r in rows
            ],
        ],
        'tracks': [
            {
                'type': 'FeatureTrack',
                'trackId': 'TAIR10_genes',
                'name': 'TAIR10 genes (NCBI RefSeq)',
                'assemblyNames': ['TAIR10'],
                'adapter': {'type': 'Gff3TabixAdapter', 'uri': 'TAIR10.genes.gff.gz'},
            },
            {
                'type': 'FeatureTrack',
                'trackId': 'TAIR10_rmsk',
                'name': 'TAIR10 RepeatMasker (UCSC GenArk)',
                'assemblyNames': ['TAIR10'],
                'adapter': {'type': 'BigBedAdapter', 'uri': f'{GENARK}.rmsk.bb'},
            },
            {
                'type': 'QuantitativeTrack',
                'trackId': 'fst_1135',
                'name': 'Fst between admixture groups, 1135 accessions (10 kb windows)',
                'assemblyNames': ['TAIR10'],
                'adapter': {'type': 'BigWigAdapter', 'uri': 'fst.bw'},
            },
            {
                'type': 'QuantitativeTrack',
                'trackId': 'omega_1135',
                'name': 'OmegaPlus selective sweep scan, 1135 accessions (10 kb windows)',
                'assemblyNames': ['TAIR10'],
                'adapter': {'type': 'BigWigAdapter', 'uri': 'omega.bw'},
            },
            {
                'type': 'VariantTrack',
                'trackId': 'snps_1135',
                'name': '1001 Genomes SNPs and short indels, 1135 accessions (SnpEff, EVA PRJNA273563)',
                'assemblyNames': ['TAIR10'],
                'adapter': {
                    'type': 'VcfTabixAdapter',
                    'uri': f'{EVA}/PRJNA273563/1001genomes_snp-short-indel_only_ACGTN_v3.1.snpeff.garys.final.vcf.gz',
                },
            },
            {
                'type': 'VariantTrack',
                'trackId': 'insertions_1001Ara',
                'name': 'Insertion SVs across 1001 Genomes accessions (INSSV, EVA PRJEB58052)',
                'assemblyNames': ['TAIR10'],
                'adapter': {
                    'type': 'VcfTabixAdapter',
                    'vcfGzLocation': {'uri': f'{EVA}/PRJEB58052/INSSV-1001Ara_merged.vcf.gz'},
                    'index': {'indexType': 'CSI', 'location': {'uri': f'{EVA}/PRJEB58052/INSSV-1001Ara_merged.vcf.csi'}},
                },
            },
            {
                'type': 'FeatureTrack',
                'trackId': 'syri_regions_on_TAIR10',
                'name': 'SyRI regions on TAIR10, one row per accession',
                'assemblyNames': ['TAIR10'],
                'adapter': {'type': 'BedTabixAdapter', 'uri': 'syri_regions.bed.gz', 'disableGeneHeuristic': True},
                'displays': [
                    {
                        'type': 'LinearMultiRowFeatureDisplay',
                        'displayId': 'syri_regions_on_TAIR10-LinearMultiRowFeatureDisplay',
                        'rows': {'field': 'query', 'domain': names},
                    }
                ],
            },
            {
                'type': 'SyntenyTrack',
                'trackId': 'syri_1001g',
                'name': 'SyRI regions, 1001G+ accessions vs TAIR10',
                'assemblyNames': ['TAIR10', *names],
                'adapter': {'type': 'MultiGenomePAFAdapter', 'uri': 'syri_1001g.paf', 'attributeColumns': ['syri', 'color']},
                'displays': [
                    {
                        'type': 'MultiWaySyntenyDisplay',
                        'displayId': 'syri_1001g-MultiWaySyntenyDisplay',
                        'domain': names,
                        'ribbonColor': {'field': 'syri', 'domain': SYRI_TYPES},
                    }
                ],
            },
            *graph_tracks(names),
            *[t for r in rows for t in per_accession_tracks(r)],
        ],
        'defaultSession': {
            'name': '1001G+ accessions vs TAIR10, chromosome 4 knob inversion',
            'views': [
                {
                    'type': 'LinearGenomeView',
                    'assembly': 'TAIR10',
                    'loc': 'Chr4:1,400,000-3,000,000',
                    'tracks': [
                        'TAIR10_genes',
                        {'trackId': 'fst_1135', 'type': 'LinearWiggleDisplay', 'height': 60},
                        {'trackId': 'syri_regions_on_TAIR10', 'type': 'LinearMultiRowFeatureDisplay', 'height': 24 * len(names) + 20},
                        *(
                            [{'trackId': 'arabidopsis_minigraph_paths', 'type': 'LinearMultiRowFeatureDisplay', 'height': 16 * (len(names) + 1) + 20}]
                            if os.path.exists(f'{GRAPH}.paths.bed.gz')
                            else []
                        ),
                    ],
                }
            ],
        },
    }
    with open('config.json', 'w') as fh:
        json.dump(absolutize(config), fh, indent=2)
        fh.write('\n')
    print(f"{len(rows)} accessions: {' '.join(names)}")
    print(f"{len(config['tracks'])} tracks")


if __name__ == '__main__':
    main()
