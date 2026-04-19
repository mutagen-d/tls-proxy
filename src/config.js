require('dotenv').config()

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
}
const local = {
  port: parseInt(process.env.LOCAL_PORT || LOCAL_PORT, 10),
}

const config = Object.freeze({
  /**
   * - `"development"` - use `port` for http (unsecure) connection to `"http://localhost:${port}"`
   * - `"production"` - use `host` for https (secure) connection to `"https://${HOST}"`
   * @type {'development' | 'production'} */
  appEnv,
  /** @type {string} */
  fakeHost: process.env.FAKE_HOST || process.env.WS_HOST,
  ws,
  remote,
  local,
})

module.exports = { config }