require('dotenv').config()

const config = {
  /**
   * host name for client-hello sni
   * @type {string} */
  host: process.env.HOST,
  /**
   * port of socket.io connection
   * @type {number} */
  port: parseInt(process.env.PORT || 443, 10),
  /**
   * socket.io auth token
   * @type {string} */
  authToken: process.env.AUTH_TOKEN,
  /**
   * - `"development"` - use `port` for http (unsecure) connection to `"http://localhost:${port}"`
   * - `"production"` - use `host` for https (secure) connection to `"https://${HOST}"`
   * @type {'development' | 'production'} */
  appEnv: process.env.APP_ENV || 'production',
}

module.exports = { config }