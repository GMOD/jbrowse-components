---
id: variant_track
title: Variant track configuration
---

Example config:

```json
{
  "type": "VariantTrack",
  "trackId": "my track",
  "name": "My Variants",
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "vcfGzLocation": {
      "uri": "http://yourhost/file.vcf.gz",
      "locationType": "UriLocation"
    },
    "index": {
      "location": {
        "uri": "http://yourhost/file.vcf.gz.tbi",
        "locationType": "UriLocation"
      }
    }
  }
}
```

#### VcfTabixAdapter configuration options

- `vcfGzLocation` - a 'file location' for the bgzip'd VCF file
- `index` - a sub-configuration schema containing
  - indexType: 'TBI' or 'CSI'. Default: 'TBI'
  - location: a 'file location' for the index

Example VcfTabixAdapter adapter config:

```json
{
  "type": "VcfTabixAdapter",
  "vcfGzLocation": {
    "uri": "http://yourhost/file.vcf.gz",
    "locationType": "UriLocation"
  },
  "index": {
    "location": {
      "uri": "http://yourhost/file.vcf.gz.tbi",
      "locationType": "UriLocation"
    }
  }
}
```
