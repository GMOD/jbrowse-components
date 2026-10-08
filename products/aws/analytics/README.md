# JBrowse analytics

The `jbrowse-analytics` Lambda behind `analytics.jbrowse.org/api/v1` records one
event per JBrowse 1 or JBrowse 2 usage ping. `index.mjs` is its source.

The Lambda sends each event to a Firehose delivery stream, and Firehose writes
gzipped newline-delimited JSON to a private, versioned S3 bucket about every 15
minutes:

```
s3://jbrowse-analytics-<account>/events/jb2/2026/10/08/*.json.gz
s3://jbrowse-analytics-<account>/events/jb1/2026/10/08/*.json.gz
```

The date in the path is the UTC arrival time. Each line holds the same fields
the DynamoDB items held, as plain JSON, including the client address. Records
Firehose cannot deliver go under `errors/`, and delivery errors are logged to
the `/aws/kinesisfirehose/jbrowse-analytics` log group.

`template.yaml` creates the bucket, the two streams and the policy that lets the
Lambda write to them. The Lambda and its API Gateway predate the stack and stay
outside it, so the endpoint released JBrowse versions call does not change.

## Deploy

Needs the AWS CLI and `zip`.

```bash
./deploy.sh
```

Pings fail for a few seconds while the Lambda moves from `nodejs12.x` to
`nodejs22.x`.

## Moving off DynamoDB

The events used to live only in the `JB1_Analytics_Events` and
`JB2_Analytics_Events` tables.

1. `./deploy.sh` starts dual-writing to Firehose and DynamoDB. A ping fails only
   if both writes fail.
2. After a week or two, compare a day's event count in S3 with the same day in
   DynamoDB.
3. `WRITE_DYNAMO=false ./deploy.sh` stops the DynamoDB writes.
4. Export both tables in full to `s3://jbrowse-analytics-<account>/dynamodb/`
   and check each manifest's item count against the table's.
5. Delete the tables. Deleting is irreversible.
