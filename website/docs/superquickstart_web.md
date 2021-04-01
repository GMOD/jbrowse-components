---
id: superquickstart_web
title: Super-quick start for jbrowse web
toplevel: true
---

This guide assumes you have some familiarity with JBrowse and running static
sites

This is a quick overview to get started running JBrowse 2 from scratch

This guide assumes you have

- a webserver that reads files from /var/www/html/ e.g. apache or nginx
- Node 10+ installed
- GenomeTools installed e.g. `sudo apt install genometools` or `brew install brewsci/bio/genometools`
- samtools installed e.g. `sudo apt install samtools` or `brew install samtools`

```bash
## Install jbrowse 2 CLI tools
npm install -g @jbrowse/cli

## Downloads latest release and unpacks it to web server folder
jbrowse create /var/www/html/jbrowse2

## Create indexed FASTA file for your genome
samtools faidx genome.fa

## Add your genome assembly to the config at /var/www/html/jbrowse2/config.json
## Also copies the files to this directory
jbrowse add-assembly genome.fa --out /var/www/html/jbrowse2 --load copy


## Copy file.bam and file.bam.bai to /var/www/html/jbrowse2 and adds track to
## the config at /var/www/html/jbrowse2/config.json. Note that I can refer to a
## folder name with --out, in which case it is foldername+'config.json' or a
## specific filename for a config
jbrowse add-track file.bam --out /var/www/html/jbrowse2/config.json --load copy

## adds a url entry for a bam file to the  config.json, but no file operations
## performed
jbrowse add-track http://website.com/myfile.bam --out /var/www/html/jbrowse2


## add a BigWig track
jbrowse add-track myfile.bw --out /var/www/html/jbrowse2


## load gene annotations from a GFF
gt gff3 -sortlines -tidy myfile.gff > myfile.sorted.gff
bgzip myfile.sorted.gff
tabix myfile.sorted.gff.gz
jbrowse add-track myfile.sorted.gff.gz --out /var/www/html/jbrowse2 --load copy
```

You can now visit http://localhost/jbrowse2 and your genome should be loaded
with a bigwig, a GFF, and a BAM file!

This guide is meant to be a super-quick conceptual overview for getting jbrowse
2 setup, but if you are new to the command line or to jbrowse in general, you
might want to start with the slightly-longer quick-start guide
[quickstart_cli](here).
