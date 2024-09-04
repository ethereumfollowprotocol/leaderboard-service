interface EnvironmentVariables {
  readonly NODE_ENV: 'development' | 'production' | 'test'
  readonly DATABASE_URL: string
  readonly ENABLE_DATABASE_LOGGING: string
  readonly ENS_API_URL: string
  readonly ENS_REFRESH_INTERVAL: number
  readonly SLEEP_INTERVAL: number
  readonly SNITCH_ID: string
}

declare module 'bun' {
  interface Env extends EnvironmentVariables {}
}

declare namespace NodeJs {
  interface ProcessEnv extends EnvironmentVariables {}
}
