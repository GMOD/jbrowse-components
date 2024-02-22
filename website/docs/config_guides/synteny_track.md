---
id: synteny_track
title: Synteny track config
---

Example SyntenyTrack config:

```json
{
  "type": "SyntenyTrack",
  "trackId": "dotplot_track",
  "assemblyNames": ["YJM1447", "R64"],
  "name": "dotplot",
  "adapter": {
    "type": "PAFAdapter",
    "pafLocation": {
      "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/yeast/YJM1447_vs_R64.paf"
    },
    "assemblyNames": ["YJM1447", "R64"]
  }
}
```

We can load a SyntenyTrack from PAF with the CLI e.g. with:

```bash
jbrowse add-track myfile.paf --type SyntenyTrack --assemblyNames \
    grape,peach --load copy --out /var/www/html/jbrowse2
```

The first assembly is the "target" and the second assembly is the "query."

See how to
[configure JBrowse using the CLI](/docs/quickstart_web/#adding-a-synteny-track-from-a-paf-file)
for more ways to load synteny tracks with the CLI.

### PAFAdapter config

The PAF adapter reflects a pairwise alignment, and is outputted by tools like
minimap2. It can be used for SyntenyTracks:

```json
{
  "type": "PAFAdapter",
  "pafLocation": {
    "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/yeast/YJM1447_vs_R64.paf"
  },
  "assemblyNames": ["YJM1447", "R64"]
}
```

Slots

- `pafLocation` - the location of the PAF file. The pafLocation can refer to a
  gzipped or unzipped delta file. It will be read into memory entirely as it is
  not an indexed file format.
- `assemblyNames` - list of assembly names, typically two (first in list is
  target, second is query)
- `queryAssembly` - alternative to assemblyNames: just the assemblyName of the
  query
- `targetAssembly` - alternative to assemblyNames: just the assemblyName of the
  target

### DeltaAdapter config

The DeltaAdapter is used to load .delta files from MUMmer/nucmer. It can be used
for SyntenyTracks:

```json
{
  "type": "DeltaAdapter",
  "deltaLocation": {
    "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/yeast/YJM1447_vs_R64.paf"
  },
  "assemblyNames": ["YJM1447", "R64"]
}
```

Slots

- `deltaLocation` - the location of the delta file. The deltaLocation can refer
  to a gzipped or unzipped delta file. It will be read into memory entirely as
  it is not an indexed file format.
- `assemblyNames` - list of assembly names, typically two (first in list is
  target, second is query)
- `queryAssembly` - alternative to assemblyNames: just the assemblyName of the
  query
- `targetAssembly` - alternative to assemblyNames: just the assemblyName of the
  target

### ChainAdapter config

The ChainAdapter is used to load .chain files from MUMmer/nucmer. It can be used
for SyntenyTracks:

```json
{
  "type": "DeltaAdapter",
  "deltaLocation": {
    "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/yeast/YJM1447_vs_R64.paf"
  },
  "assemblyNames": ["YJM1447", "R64"]
}
```

Slots

- `chainLocation` - the location of the UCSC chain file. The chainLocation can
  refer to a gzipped or unzipped delta file. It will be read into memory
  entirely as it is not an indexed file format.
- `assemblyNames` - list of assembly names, typically two (first in list is
  target, second is query)
- `queryAssembly` - alternative to assemblyNames: just the assemblyName of the
  query
- `targetAssembly` - alternative to assemblyNames: just the assemblyName of the
  target

### MCScanAnchorsAdapter

The .anchors file from MCScan refers to pairs of homologous genes and can be
loaded into synteny tracks in JBrowse 2:

```json
{
  "type": "MCScanAnchorsAdapter",
  "mcscanAnchorsLocation": {
    "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/synteny/grape.peach.anchors.gz"
  },
  "bed1Location": {
    "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/synteny/grape_vs_peach/grape.bed.gz"
  },
  "bed2Location": {
    "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/synteny/grape_vs_peach/peach.bed.gz"
  },
  "assemblyNames": ["grape", "peach"]
}
```

[This guide](<https://github.com/tanghaibao/jcvi/wiki/MCscan-(Python-version)>)
shows a demonstration of how to create the anchors and bed files (the .bed files
are intermediate steps in creating the anchors files and are required by the
MCScanAnchorsAdapter).

Slots:

- `mcscanAnchorsLocation` - the location of the .anchors file from the MCScan
  workflow. The .anchors file has three columns. It can be gzipped or ungzipped,
  and is read into memory whole
- `bed1Location` - the location of the first assemblies .bed file from the
  MCScan workflow. It can be gzipped or ungzipped, and is read into memory
  whole. This would refer to the gene names on the "left" side of the .anchors
  file.
- `bed2Location` - the location of the second assemblies .bed file from the
  MCScan workflow. It can be gzipped or ungzipped, and is read into memory
  whole. This would refer to the gene names on the "right" side of the .anchors
  file.

### MCScanSimpleAnchorsAdapter

The "simple" .anchors.simple file from MCScan refers to pairs of homologous
genes and can be loaded into synteny tracks in JBrowse 2:

```json
{
  "type": "MCScanSimpleAnchorsAdapter",
  "mcscanSimpleAnchorsLocation": {
    "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/synteny/grape.peach.anchors.simple.gz"
  },
  "bed1Location": {
    "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/synteny/grape_vs_peach/grape.bed.gz"
  },
  "bed2Location": {
    "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/synteny/grape_vs_peach/peach.bed.gz"
  },
  "assemblyNames": ["grape", "peach"]
}
```

[This guide](<https://github.com/tanghaibao/jcvi/wiki/MCscan-(Python-version)>)
shows a demonstration of how to create the anchors and bed files (the .bed files
are intermediate steps in creating the anchors.simple files and are required by
the MCScanSimpleAnchorsAdapter)

Slots:

- `mcscanSimpleAnchorsLocation` - the location of the .anchors.simple file from
  the MCScan workflow (this file has 5 columns, start and end gene from bed1,
  start and end genes from bed2, and score). It can be gzipped or ungzipped, and
  is read into memory whole
- `bed1Location` - the location of the first assemblies .bed file from the
  MCScan workflow. It can be gzipped or ungzipped, and is read into memory
  whole. This would refer to the gene names on the "left" side of the .anchors
  file.
- `bed2Location` - the location of the second assemblies .bed file from the
  MCScan workflow. It can be gzipped or ungzipped, and is read into memory
  whole. This would refer to the gene names on the "right" side of the .anchors
  file.
