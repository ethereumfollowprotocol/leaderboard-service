import { type Kysely, type QueryResult, sql } from 'kysely'
import { database } from '#/database'
import { env } from '#/env'
import { logger } from '#/logger'
import type { CountRow, ENSProfile, ENSProfileResponse, LeaderBoardRow } from '#/types'
import { arrayToChunks } from '#/utilities'

export async function analyze() {
  let addresses: `0x${string}`[] = []
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

    const data = (await Promise.all(response.map(response => response.json()))) as {
      response_length: number
      response: ENSProfileResponse
    }[]
    logger.log(`Resolving ENS requests...`)
    const fetchedRecords = data.flatMap(datum => datum.response)
    const filteredRecords = fetchedRecords.filter(record => record.type === 'success')
    logger.log(`fetchedRecords ${fetchedRecords.length}`)
    logger.log(`filteredRecords ${filteredRecords.length}`)


    const formatted = filteredRecords.map(record => {
      return {
        name: record.name,
        address: record.address.toLowerCase(),
        avatar: record.avatar
      }
    })
    logger.log(`Updating ENS Cache: ${formatted.length} records...`)
    if(formatted.length > 0){
        const insertENSCache = await database.insertInto('ens_metadata')
        .values(formatted)
        .onConflict(oc => oc
            .column('address')
            .doUpdateSet(eb => ({
                name: eb.ref('excluded.name'),
                avatar: eb.ref('excluded.avatar')
            }))    
        )
        .executeTakeFirst()
    }

    logger.log(`Fetching leaderboard counts...`)
    const reloaded = sql<CountRow>`SELECT * FROM public.view__join__efp_leaderboard`
    const reloadedResult = await reloaded.execute(database)

    for (const row of reloadedResult.rows) {

      leaderboard.push({
        address: row.address,
        name: row.ens_name,
        avatar: row.ens_avatar,
        mutuals_rank: row.mutuals_rank,
        followers_rank: row.followers_rank,
        following_rank: row.following_rank,
        blocks_rank: row.blocks_rank,
        mutuals: row.mutuals,
        following: row.following,
        followers: row.followers,
        blocks: row.blocks
      })
      index++

    }

    logger.log(`Cleaning up Table...`)
    const truncate = sql`TRUNCATE TABLE efp_leaderboard`
    const clearTable = await truncate.execute(database)

    logger.log(`Inserting new leaderboard data...`)
    const insert = await database.insertInto('efp_leaderboard').values(leaderboard).executeTakeFirst()
    if (insert.numInsertedOrUpdatedRows !== BigInt(leaderboard.length)) {
      logger.error(`Failed to insert leaderboard rows ${JSON.stringify(leaderboard)}`)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : error
    logger.error('EXCEPTION', errorMessage)
  }
  logger.info('DONE')
}


