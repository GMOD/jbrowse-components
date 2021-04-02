---
id: superquickstart_web
title: Super-quick start guide for JBrowse web
toplevel: true
---

This is a quick overview to get started running JBrowse 2 from scratch using the command line. It is
helpful if you have some familiarity with the command line in general to follow
these steps. This guide also assumes you have:

- a webserver that reads files from /var/www/html/ e.g. Apache or nginx (not strictly necessary for jbrowse to run, see footnote)
- node 10+ installed
- genometools installed e.g. `sudo apt install genometools` or `brew install brewsci/bio/genometools`, used for sorting GFF3 for creating tabix GFF
- samtools installed e.g. `sudo apt install samtools` or `brew install samtools`, used for creating FASTA index and BAM/CRAM processing
- tabix installed e.g. `sudo apt install tabix` or `brew install htslib`, used for created tabix indexes for BED/VCF/GFF files

```bash
## Install JBrowse 2 CLI tools
npm install -g @jbrowse/cli

## Downloads latest release and unpacks it to web server folder
jbrowse create /var/www/html/jbrowse2

## Create indexed FASTA file for your genome
samtools faidx genome.fa

## Add your genome assembly to the config at /var/www/html/jbrowse2/config.json
## Also copies the files to this directory
jbrowse add-assembly genome.fa --out /var/www/html/jbrowse2 --load copy


## Copy file.bam and file.bam.bai to /var/www/html/jbrowse2 and adds track to
## the config at /var/www/html/jbrowse2/config.json. Assumes that file.bam and
## file.bam.bai exist
jbrowse add-track file.bam --out /var/www/html/jbrowse2/config.json --load copy

## Adds a url entry for a bam file to the  config.json, but no file operations
## performed, assumes BAM file is at http://website.com/myfile.bam.bai
jbrowse add-track http://website.com/myfile.bam --out /var/www/html/jbrowse2


## If your BAM index (bai) is not filename+'.bai' then you can manually
## specifies index location with --index flag
jbrowse add-track myfile.bam --index myfile.bai --out /var/www/html/jbrowse2


## Alternative loading syntax where I specify a config file, and then this can
## be loaded via http://localhost/jbrowse2/?config=alt_config.json
## Also demonstrates using --load symlink instead of --load copy to avoid
## copying large files
jbrowse add-assembly mygenome.fa --out /var/www/html/jbrowse2/alt_config.json --load symlink


## add a BigWig track
jbrowse add-track myfile.bw --out /var/www/html/jbrowse2 --load copy


## load gene annotations from a GFF, using "GenomeTools" (gt) to sort the gff
## and tabix to index the GFF3
gt gff3 -sortlines -tidy -retainids myfile.gff > myfile.sorted.gff
bgzip myfile.sorted.gff
tabix myfile.sorted.gff.gz
jbrowse add-track myfile.sorted.gff.gz --out /var/www/html/jbrowse2 --load copy
```

You can now visit http://localhost/jbrowse2 and your genome should be loaded
with a bigwig, a GFF, and a BAM file!

This guide is meant to be a super-quick conceptual overview for getting jbrowse
2 setup, but if you are new to the command line or to jbrowse in general, you
might want to start with the slightly-longer quick-start guide
[here](quickstart_cli).

Footnote: JBrowse doesn't strictly need Apache or nginx, it is "static site
compatible" meaning it uses no server side code and can run on any static
website hosting. For example, you can upload the jbrowse folder that we
prepared here in /var/www/html/jbrowse2 to Amazon S3, and it will work there
too. See the FAQ for [what webserver do I
need](faq#what-web-server-do-i-need-to-run-jbrowse-2) for more info.
