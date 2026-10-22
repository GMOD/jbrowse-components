---
title: Writing a JBrowse config with an agent
sidebar_label: Writing a config
description:
  An agent with a shell fetches and indexes the data, writes a JBrowse config,
  validates it and renders it, with no app running
---

An agent with a shell, such as Claude Code, can build a JBrowse view as a file.
The [config and session JSON](/docs/automating) is the whole interface: the
agent writes it, checks it, and opens or renders it. No app has to be running,
and the result is a file you can keep, share or regenerate.

## The loop

1. **Start from a hosted genome.** [](/docs/agents_hosted_data) has every UCSC
   and GenArk assembly as a ready config with its sequence, refName aliases and
   gene index. Downloading hg38 to show one gene turns a short task into a long
   one.
2. **Make the data loadable.** `bgzip` and `tabix` a VCF, BED or GFF;
   `samtools index` a BAM or CRAM. [](/docs/config_guides/file_types) maps each
   format to its adapter and track type.
3. **Write the document.** A track can be just `trackId`, `uri` and
   `assemblyNames`; JBrowse infers the type and adapter from the extension, and
   resolves a relative `uri` against the config's own location.
4. **Validate.** `jbrowse validate config.json` (from
   [@jbrowse/cli](/docs/cli#jbrowse-validate)) exits 1 on errors.
5. **Look at it.** `jbrowse-desktop config.json` opens it, and
   [](/docs/agents_capture) renders it to an image. A config that loads is not
   yet a track that drew.

```json
{
  "$schema": "https://jbrowse.org/jb2/schema/v5/config.json",
  "assemblies": [
    {
      "name": "hg38",
      "sequence": {
        "type": "ReferenceSequenceTrack",
        "trackId": "hg38-ref",
        "adapter": { "type": "BgzipFastaAdapter", "uri": "hg38.fa.gz" }
      }
    }
  ],
  "tracks": [
    { "trackId": "sample", "uri": "sample.bam", "assemblyNames": ["hg38"] }
  ],
  "defaultSession": {
    "views": [
      {
        "type": "LinearGenomeView",
        "assembly": "hg38",
        "loc": "chr1:1-100000",
        "tracks": ["sample"]
      }
    ]
  }
}
```

## Why validate

JBrowse ignores a config key it does not declare. A misspelled slot, or a
`renderers` block from an old config, loads without complaint and does nothing.
The validator reports those as errors, along with dangling `trackId` and
assembly references and duplicate ids. Its warnings cover what JBrowse reports
on load anyway, such as a type registered by a plugin it cannot see.

## What the agent should read

- [llms.txt](https://jbrowse.org/jb2/llms.txt) indexes every docs page as
  Markdown.
- `https://jbrowse.org/jb2/docs/config/<type>.md`, the type name lowercased,
  lists one type's slots. [](/docs/config) indexes them.
- [](/docs/config_guides/file_types) picks an adapter from a file.

## Claude Code skills

The JBrowse repository keeps Claude Code skills that brief an agent on this
loop. Copy a folder into `~/.claude/skills/` to install one:

- [jbrowse-authoring](https://github.com/GMOD/jbrowse-components/tree/main/.claude/skills/jbrowse-authoring):
  the config shape, the session spec, and the validator
- [jbrowse-hosted-data](https://github.com/GMOD/jbrowse-components/tree/main/.claude/skills/jbrowse-hosted-data):
  finding a hosted assembly and its tracks
- [jbrowse-capture](https://github.com/GMOD/jbrowse-components/tree/main/.claude/skills/jbrowse-capture):
  rendering a view and knowing when it finished drawing
