---
id: bcc2020_embedding_jbrowse_getting_started
title: Getting started
---

## Welcome!

We've been working hard on JBrowse 2 and are happy to be able to start sharing
it with all of you. We're still in development, so what we use today should be
considered "beta" software. The up-side for you, though, is that an suggestions
you make are more likely to get quickly integrated into JBrowse 2.

## What you need

If you use our provided virtual machine (VM) (download
[here](https://jbrowse-tutorials.s3.amazonaws.com/JBrowse%202%20BOSC.ova)),
then you'll have everything you need ready to go. To run the VM, you'll need to
download the Oracle VirtualBox software (download
[here](https://www.virtualbox.org/wiki/Downloads)). Also download the extension
pack on that page. Once VirtualBox is installed, go to `Tools -> Preferences ->
Extensions -> Add` and select the downloaded extension pack to add it.

Once VirtualBox is and the extension pack are installed, open the VM we
provided and it will import itself into VirtualBox (the name of the VM will be
"JBrowse 2 BOSC"). Then just click `Start` and it will start an Ubuntu Linux
machine with everything you need pre-installed.

A second option is to use an AWS AMI Ubuntu 2020 server set up to work with
this course.  The AMI ID for the course machine is ami-06d3d077f91ea603e and
is located in us-east-1 (Northern Virginia). If you choose to run this machine,
be sure to open incoming access on port 80 and 3000 in the security groups.

If you're not using the provided virtual Machine, you can do most of the
tutorial with a simple text editor and some way to serve files (just opening
the HTML files we create in a browser won't work, you'll need a server). If you
have node installed, you can run a simple server by running `npx serve` (or you
can install it globally with `npm install -g serve` or `yarn global add serve`
and then run `serve`).

We'll also be using the JBrowse CLI, although you can technically complete the
tutorial without it. You can install it by making sure you have node installed
and then running `npm install -g @gmod/jbrowse-cli` (or `yarn global add
@gmod/jbrowse-cli`). Check that it installed properly by running `jbrowse --help`.
