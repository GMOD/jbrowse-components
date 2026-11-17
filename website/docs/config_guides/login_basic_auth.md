---
title: Login with HTTP Basic auth
description:
  Password-protecting JBrowse Web and its data with nginx or Apache and a
  password per person
guide_category: Deployment
---

HTTP Basic auth asks for a username and password in the browser's own dialog,
once per browser session, and needs nothing beyond the web server that already
serves JBrowse. Each person gets their own password, so access is handed out and
taken back one line at a time. Put the whole JBrowse folder behind it, data
included; [](/docs/config_guides/behind_a_login) lists the rules every method
shares.

## Give each person a password

Create the password file with `htpasswd` (in `apache2-utils` on Debian and
Ubuntu, `httpd-tools` on Red Hat), then add each person:

```bash
sudo htpasswd -c /etc/nginx/jbrowse.htpasswd alice   # -c creates the file
sudo htpasswd /etc/nginx/jbrowse.htpasswd bob
```

`htpasswd -D /etc/nginx/jbrowse.htpasswd bob` takes Bob's access away.

## nginx

Set `auth_basic` on the whole server, so the app and the data share one realm
and the browser reuses the password it was given for both:

```nginx
server {
  listen 443 ssl;
  server_name jbrowse.mylab.org;
  # ssl_certificate lines here
  root /var/www/jbrowse;

  auth_basic "My lab JBrowse";
  auth_basic_user_file /etc/nginx/jbrowse.htpasswd;

  # browsers fetch the web app manifest without credentials
  location = /manifest.json {
    auth_basic off;
  }
}
```

## Apache

A `.htaccess` file in the JBrowse folder does the same (the server needs
`AllowOverride AuthConfig` for that folder):

```apache
AuthType Basic
AuthName "My lab JBrowse"
AuthUserFile /etc/apache2/jbrowse.htpasswd
Require valid-user
```

## Different tracks for different groups

Give each group a folder holding its own `config.json` and data, with its own
password file, and send its members to `?config=groupA/config.json`. In nginx:

```nginx
location /groupA/ {
  auth_basic_user_file /etc/nginx/groupA.htpasswd;
}
```

## Check that the data is protected

Without the password the data file answers `401`, and with it `206`:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -H 'Range: bytes=0-100' https://jbrowse.mylab.org/data/sample.bam
curl -s -o /dev/null -w '%{http_code}\n' -u alice -H 'Range: bytes=0-100' https://jbrowse.mylab.org/data/sample.bam
```

Browsers have no sign-out button for Basic auth; the login lasts until the
browser is closed.

## See also

- [](/docs/config_guides/behind_a_login)
- [](/docs/config_guides/login_single_sign_on)
