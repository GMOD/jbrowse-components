---
id: quickstart_web
title: JBrowse 2 web quickstart
toplevel: true
---

This guide will walk through installing jbrowse 2 on your website

JBrowse 2, like JBrowse 1, is "static site" compatible, meaning it does not
have any server side code that needs to run. We refer to JBrowse 2 for the web
as the jbrowse-web package, and jbrowse-web package is an optimized build of
our project, and is simply a folder of HTML, JS, and CSS files that can be
copied to your web directory.

### Pre-requisites

- You have a webserver such as nginx, apache2, or something else that can
  handle plain static resources (js, html, css)

- Node.js 10+ - recommend to install this from somewhere other than apt e.g.
  [NodeSource](https://github.com/nodesource/distributions/blob/master/README.md#installation-instructions)

### Using jbrowse CLI tools

We provide a set of CLI tools for initializing your instance that can do
multiple tasks such as

- downloading jbrowse 2 from github automatically
- updating an existing jbrowse 2 instance with the latest version on github
- loading a genome assembly
- loading track configs
- etc.

You can do many of these tasks manually if you have familiarity with the
system, but the CLI tool will help automate tasks for you

#### Install the CLI tools

To install the JBrowse CLI tools, we expect node v10 or greater to be installed
already, then you can use

```sh-session
npm install -g @gmod/jbrowse-cli
```

After running this command you can then test it with

```sh-session
jbrowse --version
```

This will output the current version of our CLI tools

Note: if you do not want to install the CLI tools, they are technically
optional, but they provide useful commands for managing your jbrowse
installation such as downloading a release automatically, adding tracks, genome
assemblies, etc. to your installation

#### Using jbrowse create to install jbrowse

If you are running a web server such as apache2 or nginx, you may have your web
server in a directory such as `/var/www/html`

```sh-session
jbrowse create /var/www/html/jbrowse2
```

This will download the latest JBrowse 2 release from github releases and
download it to the folder specified.

Note that `jbrowse create` simply downloads a release from github and unzips it to
the folder specified

#### Loading a genome assembly

After you have run the previous step, you will load a genome assembly, which we
refer to simply as an assembly. This is basically a FASTA file

```sh-session
cd /var/www/html/jbrowse2
jbrowse add-assembly ~/hg19.fa --load copy
```

This will copy the hg19.fa to the current folder, and initialize a file called
config.json with the hg19 assembly. Note that other options include

See [configuring assemblies](config_assembly) for more info on formats
supported for the sequence file.

#### Adding a BAM track

Once you have loaded an assembly, we can try adding a BAM track

```sh-session
jbrowse add-track ~/myfile.bam --load copy
```

This would copy myfile.bam and myfile.bam.bai (inferred filename) from the home
directory

Note that URLs are also allowed

```sh-session
jbrowse add-track http://myhost/myfile.bam
```

In this case it would not download the file, but simply put the URL in the
config.json

#### Adding a VCF track

We generally expect VCF files to be tabix indexed. If you have tabix installed
(sudo apt install tabix) then you can run

```sh-session
bgzip yourfile.vcf
tabix yourfile.vcf.gz
```

Then run

```sh-session
jbrowse add-track yourfile.vcf.gz --load copy
```

#### Conclusion

Hopefully this helps you get started with JBrowse 2

Check out the rest of the docs, for more information, and also see the CLI docs
for more info [CLI tools](cli_guide) especially for details on some of the
steps shown here.
