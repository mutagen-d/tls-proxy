require('dotenv').config()

/** @type {string[]} */
const blackList = []
/** @type {string[]} */
const directList = []

/** @type {'development' | 'production'} */
const appEnv = process.env.APP_ENV || 'production'
const isProduction = () => appEnv === 'production'
const WS_PORT = 12021
const REMOTE_PORT = 10701
const LOCAL_PORT = 5080
const ws = {
  /**
   * production ready hostname
   * @type {string} */
  host: process.env.WS_HOST,
  port: parseInt(process.env.WS_PORT || WS_PORT, 10),
  get baseURL() {
    return isProduction() ? `https://${this.host}` : `http://localhost:${this.port}`
  },
  get url() {
    return `${this.baseURL}${this.namespace}`
  },
  /**
   * socket.io auth token
   * @type {string} */
  token: process.env.WS_TOKEN,
  namespace: '/chat',
  path: '/10chat.io',
}
const remote = {
  /** @type {string} */
  host: process.env.REMOTE_HOST || '127.0.0.1',
  port: parseInt(process.env.REMOTE_PORT || REMOTE_PORT, 10),
  /** wait for socket.io event */
  waitMs: parseInt(process.env.WAIT_MS || 500, 10),
}
const local = {
  port: parseInt(process.env.LOCAL_PORT || LOCAL_PORT, 10),
}

const aes = Object.freeze({
  ivLength: 16,
  algorithm: 'aes-256-gcm',
  secret: process.env.WS_TOKEN,
})

const config = Object.freeze({
  aes,
  /**
   * - `"development"` - use `port` for http (unsecure) connection to `"http://localhost:${WS_PORT}"`
   * - `"production"` - use `host` for https (secure) connection to `"https://${WS_HOST}"`
   * @type {'development' | 'production'} */
  appEnv,
  /** @type {string} */
  fakeHost: process.env.FAKE_HOST || process.env.WS_HOST,
  ws,
  remote,
  local,
  blackList,
  directList,
})

module.exports = { config }