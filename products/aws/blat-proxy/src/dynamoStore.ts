import {
  ConditionalCheckFailedException,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb'

import type { BlatStore } from './store.ts'

// One table, three kinds of item, distinguished by key prefix: the single
// spacing lock, one counter per UTC day, and one entry per cached query. The
// day and cache items carry `expiresAt` (epoch seconds) so DynamoDB's TTL
// sweeps them; the lock is a single item that is rewritten forever.
const SLOT_KEY = 'slot'
const NOTICE_KEY = 'notice'

function num(value: number) {
  return { N: String(value) }
}

/**
 * The {@link BlatStore} port over DynamoDB. Deliberately logic-free — the
 * conditional expressions are the whole point, since they are what makes a
 * reservation atomic across concurrent Lambda instances, and everything that
 * decides policy lives in budget.ts where it can be tested without AWS.
 */
export function dynamoStore(
  tableName: string,
  client = new DynamoDBClient({}),
): BlatStore {
  return {
    async tryReserveSlot(nowMs, spacingMs) {
      try {
        await client.send(
          new UpdateItemCommand({
            TableName: tableName,
            Key: { pk: { S: SLOT_KEY } },
            UpdateExpression: 'SET lastMs = :now',
            ConditionExpression:
              'attribute_not_exists(pk) OR lastMs <= :cutoff',
            ExpressionAttributeValues: {
              ':now': num(nowMs),
              ':cutoff': num(nowMs - spacingMs),
            },
            ReturnValuesOnConditionCheckFailure: 'ALL_OLD',
          }),
        )
        return { ok: true }
      } catch (error) {
        if (error instanceof ConditionalCheckFailedException) {
          // the holder's timestamp comes back with the rejection, so the client
          // is told when the slot actually frees rather than a flat guess
          const lastMs = Number(error.Item?.lastMs?.N)
          return {
            ok: false,
            retryAtMs: (Number.isFinite(lastMs) ? lastMs : nowMs) + spacingMs,
          }
        }
        throw error
      }
    },

    async countDaily(day, max, expiresAtSeconds) {
      try {
        const result = await client.send(
          new UpdateItemCommand({
            TableName: tableName,
            Key: { pk: { S: `day#${day}` } },
            UpdateExpression: 'SET expiresAt = :ttl ADD calls :one',
            ConditionExpression: 'attribute_not_exists(calls) OR calls < :max',
            ExpressionAttributeValues: {
              ':one': num(1),
              ':max': num(max),
              ':ttl': num(expiresAtSeconds),
            },
            ReturnValues: 'UPDATED_NEW',
          }),
        )
        return { ok: true, count: Number(result.Attributes?.calls?.N) }
      } catch (error) {
        if (error instanceof ConditionalCheckFailedException) {
          return { ok: false }
        }
        throw error
      }
    },

    async readCached(key, nowSeconds) {
      const result = await client.send(
        new GetItemCommand({
          TableName: tableName,
          Key: { pk: { S: `cache#${key}` } },
        }),
      )
      const expiresAt = Number(result.Item?.expiresAt?.N)
      return expiresAt > nowSeconds ? result.Item?.body?.S : undefined
    },

    async writeCached(key, body, expiresAtSeconds) {
      await client.send(
        new PutItemCommand({
          TableName: tableName,
          Item: {
            pk: { S: `cache#${key}` },
            body: { S: body },
            expiresAt: num(expiresAtSeconds),
          },
        }),
      )
    },

    async readDailyCount(day) {
      const result = await client.send(
        new GetItemCommand({
          TableName: tableName,
          Key: { pk: { S: `day#${day}` } },
        }),
      )
      const calls = Number(result.Item?.calls?.N)
      return Number.isFinite(calls) ? calls : 0
    },

    async readNotice() {
      const result = await client.send(
        new GetItemCommand({
          TableName: tableName,
          Key: { pk: { S: NOTICE_KEY } },
        }),
      )
      return result.Item?.message?.S
    },
  }
}
