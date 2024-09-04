import { raise } from './utilities'

export const env = Object.freeze({
  NODE_ENV: getEnvVariable('NODE_ENV'),
  ENABLE_DATABASE_LOGGING: getEnvVariable('ENABLE_DATABASE_LOGGING'),
  ENS_API_URL: getEnvVariable('ENS_API_URL'),
  DATABASE_URL: getEnvVariable('DATABASE_URL'),
  ENS_REFRESH_INTERVAL: getEnvVariable('ENS_REFRESH_INTERVAL'),
  SLEEP_INTERVAL: getEnvVariable('SLEEP_INTERVAL'),
  SNITCH_ID: getEnvVariable('SNITCH_ID')
})

function getEnvVariable<T extends keyof EnvironmentVariables>(name: T) {
  return process.env[name] ?? raise(`environment variable ${name} not found`)
}
