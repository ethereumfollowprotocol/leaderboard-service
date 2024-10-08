import { ens_normalize } from '@adraffy/ens-normalize'
import { sql } from 'kysely'
import { database } from '#/database'
import { env } from '#/env'
import { logger } from '#/logger'
import type { CountRow, ENSProfile, ENSProfileResponse, LeaderBoardRow } from '#/types'
import { arrayToChunks } from '#/utilities'

export async function updateENSData() {
  try {
    logger.log(`Fetching Users...`)
    const query = sql<CountRow>`SELECT * FROM public.view__join__efp_leaderboard`
    const result = await query.execute(database)

    const leaderboard: LeaderBoardRow[] = []
    const ensData: ENSProfile[] = []
    logger.log(`Building leaderboard for ${result.rows.length} records...`)
    let index = 0

    const formattedBatches = arrayToChunks(result.rows, 10).map(batch =>
      batch.map(row => `queries[]=${row.address}`).join('&')
    )
    logger.log(`Fetching ENS data in ${formattedBatches.length} chunks...`)
    const response = await Promise.all(
      formattedBatches.map(batch => {
        return fetch(`${env.ENS_API_URL}bulk/u?${batch}`)
      })
    )
    logger.log(`Resolving ENS requests...`)

    const data = (await Promise.all(
      response.map(async response => {
        await new Promise(resolve => setTimeout(resolve, 1000)) // Wait for 1 second
        if (response.ok) {
          return response.json()
        }
      })
    )) as {
      response_length: number
      response: ENSProfileResponse
    }[]
    logger.log(`Formatting ENS requests...`)
    const validResponses = data.filter(datum => datum)
    const fetchedRecords = validResponses.flatMap(datum => datum.response)
    const filteredRecords = fetchedRecords.filter(record => record.type === 'success')
    logger.log(`fetchedRecords ${fetchedRecords.length}`)
    logger.log(`filteredRecords ${filteredRecords.length}`)

    const formatted = filteredRecords.map(record => {
      let name: string
      try {
        name = ens_normalize(record.name)
      } catch (error) {
        return {
          name: '',
          address: record.address.toLowerCase(),
          avatar: ''
        }
      }
      return {
        name: name,
        address: record.address.toLowerCase(),
        records: record.records,
        avatar:
          record.avatar?.indexOf('http') === 0 &&
          record.avatar?.indexOf('https://ipfs') !== 0 &&
          record.avatar?.indexOf('ipfs') !== 0
            ? record.avatar
            : `https://metadata.ens.domains/mainnet/avatar/${record.name}`
      }
    })
    logger.log(`Updating ENS Cache: ${formatted.length} records...`)
    if (formatted.length > 0) {
      const insertENSCache = await database
        .insertInto('ens_metadata')
        .values(formatted)
        .onConflict(oc =>
          oc.column('address').doUpdateSet(eb => ({
            name: eb.ref('excluded.name'),
            avatar: eb.ref('excluded.avatar'),
            records: eb.ref('excluded.records')
          }))
        )
        .executeTakeFirst()
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : error
    logger.error('EXCEPTION', errorMessage)
  }
}

export async function analyze() {
  let addresses: `0x${string}`[] = []
  try {
    logger.log(`Fetching leaderboard counts...`)
    const reloaded = sql<CountRow>`SELECT * FROM public.view__join__efp_leaderboard`
    const reloadedResult = await reloaded.execute(database)
    const leaderboard: LeaderBoardRow[] = []
    logger.log(`Building leaderboard for ${reloadedResult.rows.length} records...`)
    let index = 0
    for (const row of reloadedResult.rows) {
      leaderboard.push({
        address: row.address,
        name: row.ens_name,
        avatar: row.ens_avatar,
        mutuals_rank: row.mutuals_rank,
        followers_rank: row.followers_rank,
        following_rank: row.following_rank,
        blocks_rank: row.blocks_rank,
        top8_rank: row.top8_rank,
        mutuals: row.mutuals,
        following: row.following,
        followers: row.followers,
        blocks: row.blocks,
        top8: row.top8
      })
      index++
    }

    logger.log(`Cleaning up Table...`)
    const truncate = sql`TRUNCATE TABLE efp_leaderboard`
    const clearTable = await truncate.execute(database)

    logger.log(`Inserting new leaderboard data...`)
    const batchSize = 5000
    const batches = arrayToChunks(leaderboard, batchSize)
    for (const batch of batches) {
      const insert = await database.insertInto('efp_leaderboard').values(batch).executeTakeFirst()
      if (insert.numInsertedOrUpdatedRows !== BigInt(batch.length)) {
        logger.error(`Failed to insert leaderboard rows ${JSON.stringify(batch)}`)
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : error
    logger.error('EXCEPTION', errorMessage)
  }
  logger.info('DONE')
}
