---
title: Login with AWS Cognito
description:
  Putting JBrowse Web in S3 behind a Cognito login with CloudFront and
  Lambda@Edge, or behind an Application Load Balancer, with accounts you create
  for particular people
guide_category: Deployment
---

A Cognito user pool holds the accounts and runs the sign-in page, and you create
an account for each person who should see the data. Which AWS service checks the
login depends on where JBrowse lives: in an S3 bucket, CloudFront serves it and
a small Lambda@Edge function checks every request; on servers you run, an
Application Load Balancer checks the login itself. Put the whole JBrowse folder
behind it, data included; [](/docs/config_guides/behind_a_login) lists the rules
every method shares.

## Create the user pool and its accounts

Create the pool so only you can add accounts, then give it a sign-in domain:

```bash
aws cognito-idp create-user-pool --pool-name jbrowse \
  --admin-create-user-config AllowAdminCreateUserOnly=true
aws cognito-idp create-user-pool-domain --user-pool-id YOUR_POOL_ID --domain my-lab-jbrowse
```

Create an account for each person. Cognito emails them a temporary password,
which they replace at first sign-in:

```bash
aws cognito-idp admin-create-user --user-pool-id YOUR_POOL_ID --username alice \
  --user-attributes Name=email,Value=alice@mylab.org Name=email_verified,Value=true
```

`admin-disable-user` takes the access away again. A pool can also send its
sign-in to an outside identity provider through SAML or OpenID Connect, such as
your institution's login or Duo Single Sign-On.

## Files in S3: CloudFront and Lambda@Edge

Upload the JBrowse folder, `data/` included, to a bucket with public access
blocked:

```bash
aws s3 sync ./jbrowse s3://my-lab-jbrowse
```

Then:

- **Serve the bucket through CloudFront.** Create a distribution with the bucket
  as its origin, choose origin access control, apply the bucket policy
  CloudFront offers, and set the default root object to `index.html`. The bucket
  then answers `403` to anyone but CloudFront.
- **Add an app client to the user pool** that uses the authorization code grant
  with the `openid` scope, has no client secret, and lists the distribution's
  address (`https://d1234abcd.cloudfront.net`, or your own domain) as its
  callback and sign-out URL.
- **Create the Lambda function in us-east-1**, since Lambda@Edge runs only
  functions from that region, with a Node.js runtime and the code below bundled
  with its `node_modules` after `npm install cognito-at-edge`. Lambda@Edge has
  no environment variables, so the pool's settings are written into the code.
  Its execution role has to trust both `lambda.amazonaws.com` and
  `edgelambda.amazonaws.com`.
- **Publish a version and attach it to the distribution's default behavior as a
  viewer request trigger** (the Lambda console's Deploy to Lambda@Edge action
  does both), so it runs before CloudFront serves any file, cached or not.

```js
const { Authenticator } = require('cognito-at-edge')

const authenticator = new Authenticator({
  region: 'us-east-1', // the user pool's region
  userPoolId: 'YOUR_POOL_ID',
  userPoolAppId: 'YOUR_APP_CLIENT_ID',
  userPoolDomain: 'my-lab-jbrowse.auth.us-east-1.amazoncognito.com',
  // without it, a token renewed during a data request is scoped to that file's
  // folder, and every later request redirects in a loop
  cookiePath: '/',
})

exports.handler = async request => authenticator.handle(request)
```

A visitor without a valid cookie goes to the Cognito sign-in page and comes back
with the cookie set. The function renews an expired ID token from the
refresh-token cookie, so a session lasts as long as the app client's refresh
token (30 days unless you change it). It runs for every request, every range
request for a data file included, and Lambda@Edge bills each one. The
[cognito-at-edge README](https://github.com/awslabs/cognito-at-edge) lists the
options for cookie lifetime and a sign-out URL.

## Files on servers: an Application Load Balancer

When nginx on EC2 or in ECS already serves the JBrowse folder, an Application
Load Balancer in front of it can require a Cognito login on its HTTPS listener:

- **Add an app client with a client secret** that uses the authorization code
  grant, with `https://jbrowse.mylab.org/oauth2/idpresponse` (in lowercase) as
  its callback URL.
- **Put the actions below on the listener's default action**: the
  `authenticate-cognito` action runs first, and the `forward` action sends
  signed-in requests to nginx.

```json
[
  {
    "Type": "authenticate-cognito",
    "Order": 1,
    "AuthenticateCognitoConfig": {
      "UserPoolArn": "arn:aws:cognito-idp:us-east-1:123456789012:userpool/YOUR_POOL_ID",
      "UserPoolClientId": "YOUR_APP_CLIENT_ID",
      "UserPoolDomain": "my-lab-jbrowse",
      "Scope": "openid"
    }
  },
  {
    "Type": "forward",
    "Order": 2,
    "TargetGroupArn": "arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/jbrowse/EXAMPLE"
  }
]
```

```bash
aws elbv2 modify-listener --listener-arn YOUR_LISTENER_ARN --default-actions file://actions.json
```

The session lasts seven days unless `SessionTimeout` (in seconds) says
otherwise. The
[ALB authentication guide](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/listener-authenticate-users.html)
covers sign-out and the other settings.

## Check that the data is protected

Signed out, a data file redirects to the Cognito sign-in page:

```bash
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' -H 'Range: bytes=0-100' https://d1234abcd.cloudfront.net/data/sample.bam
```

Signed in, the same file loads in JBrowse.

## See also

- [](/docs/config_guides/behind_a_login)
- [](/docs/config_guides/login_single_sign_on)
- [](/docs/config_guides/authentication)
