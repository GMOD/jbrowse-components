---
title: Login with single sign-on (Duo, institutional, Google, GitHub)
description:
  Putting JBrowse Web behind Duo, an institutional login, or Google or GitHub
  accounts with OAuth2 Proxy and nginx, open to a list of people
sidebar_label: Login with single sign-on
guide_category: Deployment
---

[OAuth2 Proxy](https://oauth2-proxy.github.io/oauth2-proxy/) puts a single
sign-on login in front of the nginx that serves JBrowse: Duo, an institutional
identity provider (Okta, Microsoft Entra ID, Keycloak, Shibboleth through OpenID
Connect), or Google or GitHub accounts. After sign-in it sets a session cookie
on your site, and only the people on your list get past it. Put the whole
JBrowse folder behind it, data included; [](/docs/config_guides/behind_a_login)
lists the rules every method shares.

## Register the application with the login provider

Every provider asks for the same thing: an OpenID Connect application whose
redirect URI is `https://jbrowse.mylab.org/oauth2/callback`, with the `openid`,
`email` and `profile` scopes. It hands back a client ID, a client secret and an
issuer URL.

- **Duo.** If your institution's login already prompts for Duo, register with
  the institution's identity provider and the Duo prompt comes with it.
  Otherwise, in the Duo Admin Panel, protect a **Generic OIDC Relying Party**
  application with Duo Single Sign-On; its Metadata section lists the issuer.
  [OAuth2 Proxy's Duo page](https://oauth2-proxy.github.io/oauth2-proxy/configuration/providers/cisco_duo)
  has the details.
- **An institutional login**: ask the identity team for an OpenID Connect client
  with that redirect URI.
- **Google or GitHub**: create an OAuth app in the provider's developer console,
  and use `--provider=google` or `--provider=github` below in place of the
  issuer URL.

## Choose who gets in

List the people allowed in, one email address per line:

```text
alice@mylab.org
bob@collaborator.edu
```

Signing in with an account not on the list ends on a `403` page. Editing the
file takes effect without a restart. To let in a whole domain instead, use
`--email-domain=mylab.org`.

## Run OAuth2 Proxy

Run the proxy beside nginx, on a port only nginx reaches:

```bash
# --upstream=static://202: answer nginx's checks only; nginx serves the files
# --skip-provider-button: go straight to the provider's sign-in page
oauth2-proxy \
  --provider=oidc \
  --oidc-issuer-url=YOUR_ISSUER_URL \
  --client-id=YOUR_CLIENT_ID \
  --client-secret=YOUR_CLIENT_SECRET \
  --code-challenge-method=S256 \
  --cookie-secret="$(openssl rand -base64 32 | tr -- '+/' '-_')" \
  --authenticated-emails-file=/etc/oauth2-proxy/jbrowse-emails.txt \
  --skip-provider-button \
  --upstream=static://202 \
  --http-address=127.0.0.1:4180 \
  --reverse-proxy=true \
  --trusted-proxy-ip=127.0.0.1/32
```

Keep the cookie secret fixed in a real deployment (in a config file or
environment variable), since a new one signs everyone out.

## nginx

nginx asks the proxy about each request with `auth_request`, and sends a visitor
without a session to the sign-in page:

```nginx
server {
  listen 443 ssl;
  server_name jbrowse.mylab.org;
  # ssl_certificate lines here
  root /var/www/jbrowse;

  location /oauth2/ {
    proxy_pass http://127.0.0.1:4180;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Auth-Request-Redirect $request_uri;
    # the session cookie can outgrow nginx's default header buffer
    proxy_buffer_size 16k;
    proxy_buffers 8 16k;
  }

  location = /oauth2/auth {
    proxy_pass http://127.0.0.1:4180;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Uri $request_uri;
    proxy_set_header Content-Length "";
    proxy_pass_request_body off;
  }

  location / {
    auth_request /oauth2/auth;
    error_page 401 = /oauth2/sign_in;
  }
}
```

The session lasts a week by default (`--cookie-expire`).

## Check that the data is protected

Signed out, a data file answers with a redirect to the provider's sign-in page
instead of its bytes:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -H 'Range: bytes=0-100' https://jbrowse.mylab.org/data/sample.bam
```

```text output
302
```

Signed in, the same file loads in JBrowse, and nginx's access log shows `206`
for its range requests.

## See also

- [](/docs/config_guides/behind_a_login)
- [](/docs/config_guides/login_basic_auth)
- [](/docs/config_guides/login_aws_cognito)
