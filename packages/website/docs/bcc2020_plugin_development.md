---
id: bcc2020_plugin_development
title: BCC2020 - Plugin development course
---

Welcome to the BCC2020 plugin development course

This will cover, starting from scratch, how we can develop a JBrowse 2 plugin

### Install CLI tools

To start, we will install the jbrowse-cli

```sh
sudo npm install -g @gmod/jbrowse-cli
```

Depending on your setup you might need to use sudo for this. We will use the
CLI to download the latest release from github, this is a convenience tool that
saves us some steps from manually downloading it

```sh
cd /var/www/html
sudo jbrowse create myfolder
```

This will create a jbrowse2 instance in a folder named myfolder. We can now
visit http://localhost/myfolder and see that this gives us a message that
jbrowse2 is not yet configured

### Starting to create a plugin

Now that we have initialized an instance, we will look at how to use plugins

We are going to follow an example of

1. Downloading data from the UCSC API
2. Creating custom drawing code
3. A template for a custom view type

Let's grab the UCSC API starter example. This is a full working example to get things going quickly

```
# go back to home directory for developing code
cd ~/
git clone https://github.com/cmdcolin/jbrowse-plugin-ucsc-api
cd jbrowse-plugin-ucsc-api
yarn
yarn develop --port 9001
```

This will build the plugin and serve it with a webpack-dev-server on port 9001

We can then load our in-development plugin with our production version of jbrowse http://localhost/myfolder/?config=http://localhost:9001/config_ucsc_api.json

If you had a github clone of jbrowse-components, with the packages/jbrowse-web started, you could do this with http://localhost:3000/?config=http://localhost:9001/config_ucsc_api.json instead

### What is happening here

1. We are running our plugin on a custom port. This is a small build of just
   plugin code, but it is live watched and bundled by webpack
   what we call the pluginManager. Your plugin does not install React itself!
2. We are pointing the instance we made with `jbrowse create myfolder`
   to the config that is provided by the plugin

See the plugin here https://github.com/cmdcolin/jbrowse-plugin-ucsc-api/blob/master/assets/config_ucsc_api.json

![](/jb2/img/bcc2020_img1.png)

### Combining the UCSC API plugin with a custom renderer

Let's look at another plugin

```sh
git clone https://github.com/cmdcolin/jbrowse-plugin-arc-renderer
cd jbrowse-plugin-arc-renderer
yarn
yarn develop --port 9000
```

This will start the plugin for the arc renderer on port 9000. Now, keep the
UCSC API plugin running on port 9001, and visit

http://localhost/myfolder/?config=http://localhost:9000/config_arc_renderer.json

This will load the following file
https://github.com/cmdcolin/jbrowse-plugin-arc-renderer/blob/master/assets/config_arc_renderer.json

Note that this is rendering the data from the UCSC API, showing enhancer-gene
interactions!

![](/jb2/img/bcc2020_img2.png)

### Making completely custom view types

Many new things are possible by making completely custom view types in JBrowse 2

Plugins can basically register a new view type that is a ReactComponent without much else, allowing integration of diverse other view types that are not really constrained at all

Here is a template we can work from

https://github.com/cmdcolin/jbrowse-plugin-barchart-view

Here is a silly example with a custom Hello world view type

![](/jb2/img/bcc2020_img3.png)

### Debugging your plugins

The examples allowed us to get us quickly setup

In your daily work we encourage you to clone the jbrowse-components repo and
run off a dev version of jbrowse 2 e.g. follow the steps below

```
git clone https://github.com/gmod/jbrowse-components
cd jbrowse-components
yarn
cd packages/jbrowse-web
yarn start
```

Then point your dev version of jbrowse 2 at the dev version of your plugin
http://localhost:3000/?config=http://localhost:9001/config_ucsc_api.json

A major benefit to using a github clone of jbrowse 2 compared with the version
from `jbrowse create myfolder` is that you will get better stack traces

### Loading a genome and using plugins in production

In the previous examples, we used our sample data from a plugins preconfigured
configs

Let's start to create a production instance of JBrowse. We can use the jbrowse
CLI tools to load some data. We will refer to an existing genome fasta file on
the web, and a refname alias map (tab separated association of chr1->1, etc.)

```sh
cd /var/www/html/myfolder
jbrowse add-assembly https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz --refNameAliases https://jbrowse.org/genomes/hg19/hg19_aliases.txt
```

Then we could add a gene track

```sh
jbrowse add-track https://s3.amazonaws.com/jbrowse.org/genomes/hg19/GRCh37_latest_genomic.sort.gff.gz  --config '{"renderer": {"type": "SvgFeatureRenderer"}}'
```

Or a track from UCSC

```sh
jbrowse add-track https://jbrowse.org/genomes/hg19/knownGene.bb --config  '{"renderer": {"type": "SvgFeatureRenderer"} }'
```

Now visit http://localhost/myfolder and open up a new linear genome view with
the hg19 assembly and you should see these tracks.

Now you can edit your config to contain runtime plugins and use this in
production
