const { config } = require('../config')
const { Defer } = require('./defer')
const { createLogger } = require('./logger')

let defer
const logger = createLogger('Fetch')
/**
 * @param {import('socket.io')}
 */
const fetchIP = async () => {
  if (defer) {
    return defer.promise
  }
  defer = new Defer()
  if (config.appEnv === 'development') {
    const ip = '127.0.0.1'
    defer.resolve(ip)
    return ip
  }
  const headers = { 'user-agent': 'curl/7.81.0' }
  try {
    const res = await fetch('https://2ip.io', { headers })
    let ip = await res.text()
    ip = ip.trim()
    logger.log(`IP: ${ip}`)
    defer.resolve(ip)
    return ip
  } catch (e) {
    console.log(e)
    defer.resolve('')
    return ''
  }
}

module.exports = { fetchIP }
