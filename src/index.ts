#!/usr/bin/env bun
import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { gracefulExit } from 'exit-hook'
import { env } from '#/env'
import { analyze } from '#/leaderboard'
import { logger } from '#/logger'
import { sleep } from '#/utilities'

async function beginLeaderboardAnalysis() {
  try {
    logger.info(`Analyzing Follows...`)

    for (;;) {
      logger.info('Waiting...')

      await analyze()
      await sleep(3600_000)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : error
    logger.error('EXCEPTION', errorMessage)
  }
}

async function runDbmateCommand(command: string): Promise<void> {
  return new Promise<void>((resolve: () => void, reject: (reason?: any) => void) => {
    const cmd = 'bunx'
    const args = ['dbmate', command]
    const cmdWithArgs: string = [cmd, ...args].join(' ')
    const dbmate: ChildProcessWithoutNullStreams = spawn(cmd, args)

    dbmate.stdout.on('data', (data: Buffer) => {
      console.log(data.toString())
    })

    dbmate.stderr.on('data', (data: Buffer) => {
      console.error(data.toString())
    })

    dbmate.on('close', (code: number) => {
      if (code === 0) {
        resolve()
        console.log(`${cmdWithArgs} process exited with code ${code}`)
      } else {
        reject(new Error(`${cmdWithArgs} process exited with code ${code}`))
      }
    })
  })
}

async function main() {
  try {
    logger.log(`Process ID: ${process.pid}`)
    // wait for db to be up
    for (;;) {
      try {
        logger.log(`dbmate status`, `🗄️`)
        await runDbmateCommand('status')
        break
      } catch (error) {
        logger.warn(error)
        await sleep(1_000)
      }
    }

    logger.box(`EFP Leaderboard Analysis`, '🔍')

    await beginLeaderboardAnalysis()
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : error
    logger.fatal(errorMessage)
    gracefulExit(1)
  }
  logger.log('end')
}

main()
