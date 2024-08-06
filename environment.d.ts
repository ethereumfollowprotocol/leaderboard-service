interface EnvironmentVariables {
  readonly NODE_ENV: 'development' | 'production' | 'test'
  readonly DATABASE_URL: string
  readonly ENABLE_DATABASE_LOGGING: string
}

declare module 'bun' {
  interface Env extends EnvironmentVariables {}
}

declare namespace NodeJs {
  interface ProcessEnv extends EnvironmentVariables {}
}
