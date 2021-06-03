---
id: superquickstart_web
title: Super-quick start guide for JBrowse web
toplevel: true
---

This is a quick overview to get started running JBrowse 2 from scratch using
the command line. It is helpful if you have some familiarity with the command
line, and with some bioinformatics tools like samtools in general to follow
these steps. This guide also assumes you have:

- a webserver that reads files from /var/www/html/ e.g. Apache or nginx (not
  strictly necessary for jbrowse to run, see footnote)
- node 10+ installed
- genometools installed e.g. `sudo apt install genometools` or `brew install brewsci/bio/genometools`, used for sorting GFF3 for creating tabix GFF
- samtools installed e.g. `sudo apt install samtools` or `brew install samtools`, used for creating FASTA index and BAM/CRAM processing
- tabix installed e.g. `sudo apt install tabix` or `brew install htslib`, used
  for created tabix indexes for BED/VCF/GFF files

## Super-quick overview for CLI

```bash
## Install JBrowse 2 CLI tools, note: if you want to use the jbrowse command
## under the sudo user, change this to `sudo npm install -g @jbrowse/cli`, but
## sometimes it is better to work under the principle of least priviledge and
## operate under a normal user so this guide does not use this
npm install -g @jbrowse/cli


## Use the `jbrowse create` command to download the latest release, and put it
## in a web server directory
jbrowse create /var/www/html/jbrowse2

## Alternatively, you may download to a directory, and then move it to the web
## directory
jbrowse create ~/mylocaljbrowse
mv ~/mylocaljbrowse /var/www/html/jbrowse2



## Create indexed FASTA file and load it using the add-assembly command
## Add your genome assembly to the config at /var/www/html/jbrowse2/config.json
## Also copies the files to this directory
samtools faidx genome.fa
jbrowse add-assembly genome.fa --out /var/www/html/jbrowse2 --load copy

## Copies file.bam and file.bam.bai to /var/www/html/jbrowse2 and adds track to
## the config at /var/www/html/jbrowse2/config.json. Assumes that file.bam and
## file.bam.bai exist
samtools index file.bam
jbrowse add-track file.bam --out /var/www/html/jbrowse2/ --load copy

## Adds a url entry for a bam file to the config.json, the URL is stored in the
## config instead of downloading files, so no --load flag is needed
jbrowse add-track http://website.com/myfile.bam --out /var/www/html/jbrowse2

## If your BAM index (bai) is not filename+'.bai' then you can manually specify
## the --index flag. The --index flag also works with loading tabix tracks too
jbrowse add-track myfile.bam --index myfile.bai --out /var/www/html/jbrowse2 --load copy

## Outputting to a specific config file instead of a config directory
## Alternative loading syntax where I specify a config file, and then this can
## be loaded via http://localhost/jbrowse2/?config=alt_config.json
jbrowse add-assembly mygenome.fa --out /var/www/html/jbrowse2/alt_config.json --load copy

## load gene annotations from a GFF, using "GenomeTools" (gt) to sort the gff
## and tabix to index the GFF3
gt gff3 -sortlines -tidy -retainids myfile.gff > myfile.sorted.gff
bgzip myfile.sorted.gff
tabix myfile.sorted.gff.gz
jbrowse add-track myfile.sorted.gff.gz --out /var/www/html/jbrowse2 --load copy

## Example of using --subDir to organize your data directory:
## copies myfile.bam and myfile.bam.bai to /var/www/html/jbrowse2/my_bams
## folder, which helps organize your data folder
jbrowse add-track myfile.bam --subDir my_bams --out /var/www/html/jbrowse2 --load copy

## Example without using the --out parameter:
## If you are in a directory with a config.json file, you can omit the --out parameter
cd /var/www/html/jbrowse2
jbrowse add-track /path/to/my/file.bam --load copy

## Demo for loading synteny data, both assemblies are outputted to a single
## config.json in /var/www/html/jbrowse2/config.json
minimap2 grape.fa peach.fa > peach_vs_grape.paf
jbrowse add-assembly grape.fa --load copy --out /var/www/html/jbrowse2/ -n grape
jbrowse add-assembly peach.fa --load copy --out /var/www/html/jbrowse2/ -n peach

## Use gt gff3 to make sorted tabixed gffs for each assembly, and then load to
## their respective ## assembly
jbrowse add-track grape.sorted.gff.gz -a grape --load copy --out /var/www/html/jbrowse2
jbrowse add-track peach.sorted.gff.gz -a peach --load copy --out /var/www/html/jbrowse2

## Load the synteny "track" from a PAF file. Note the order matters here for
## the --assemblyNames parameter. If minimap2 is run like `minimap2 grape.fa
## peach.fa` then you load --assemblyNames peach,grape. the order is reversed
## because the syntax is minimap2 ref.fa query.fa on the CLI and query (left side
## of PAF) and target (right hand side) in PAF output file
jbrowse add-track peach_vs_grape.paf --assemblyNames peach,grape --out load copy




## After you've had jbrowse for awhile, you can upgrade to our latest release
jbrowse upgrade /var/www/html/jbrowse2

```

## Conclusion

You can now visit http://localhost/jbrowse2 and your genome should be ready!

This guide is meant to be a super-quick conceptual overview for getting jbrowse
2 setup, but if you are new to the command line or to jbrowse in general, you
might want to start with the slightly-longer quick-start guide
[here](quickstart_cli).

## Footnote

JBrowse doesn't strictly need Apache or nginx, it is "static site
compatible" meaning it uses no server side code and can run on any static
website hosting. For example, you can upload the jbrowse folder that we
prepared here in /var/www/html/jbrowse2 to Amazon S3, and it will work there
too. See the FAQ for [what webserver do I
need](faq#what-web-server-do-i-need-to-run-jbrowse-2) for more info.
