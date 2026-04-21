const crypto = require('crypto')
const msgpackr = require('msgpackr')
const { config } = require('../config')
const { aes: _aes } = require('../tools/aes')

/**
 * @typedef {{
 *  name: string;
 *  value: string;
 *  expires: string;
 *  path: string;
 *  domain: string
 * }} ICookie
 */

const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0'
/**
 * 
 * @param {{
 *  aes?: typeof _aes,
 *  isClient: boolean
 * }} [opts]
 */
const createPacker = (opts) => {
  opts = opts || {}
  const aes = opts.aes || _aes
  const isClient = opts.isClient
  /** @param {Buffer} data */
  const clientPack = (data) => {
    const base64 = data.toString('base64')
    const rnd = crypto.randomBytes(8).toString('hex')
    const headers = [
      'GET / HTTP/1.1',
      `Host: ${config.fakeHost}`,
      `User-Agent: ${userAgent}`,
      'Accept: */*',
      `Cookie: sid=${base64}; id=${rnd}`,
      '',
      '',
    ]
    const SEP = '\r\n'
    const headerStr = headers.join(SEP)
    return Buffer.from(headerStr)
  }
  /** @param {Buffer} data */
  const serverPack = (data) => {
    const base64 = data.toString('base64')
    const ts = Math.floor(Date.now() / 1000)
    const expires = new Date(Date.now() + 86400_000)
    const headers = [
      'HTTP/1.1 401',
      'Content-Type: text/plain; charset=UTF-8',
      `Set-Cookie: req=${base64}; expires=${expires.toGMTString()}; path=/; domain=${config.fakeHost}`,
      `Set-Cookie: _ts=${ts}; expires=${expires.toGMTString()}; path=/; domain=${config.fakeHost}`,
      '',
      'Unauthorized',
    ]
    const SEP = '\r\n'
    const headerStr = headers.join(SEP)
    return Buffer.from(headerStr)
  }
  /**
   * @param  {...any} args
   */
  const pack = (...args) => {
    const buffer = msgpackr.pack(args)
    const encoded = aes.encode(buffer)
    return isClient ? clientPack(encoded) : serverPack(encoded)
  }
  /**
   * @param {string[]} headers 
   */
  const serverUnpack = (headers) => {
    const setCookies = headers.filter(h => {
      const [name, value] = h.split(':')
      return name.toLowerCase() === 'set-cookie'
    })
    /** @type {ICookie[]} */
    const cookies = setCookies
      .map(c => c.replace(/^set\-cookie\:\s+/i, ''))
      .map(c => c.split(/\;/g).reduce((acc, v, i) => {
        const [key, value] = v.trim().split('=')
        if (i === 0) {
          acc.name = key
          acc.value = value
        } else {
          acc[key] = value
        }
        return acc
      }, {}))
    const cookiesMap = cookies.reduce((acc, c) => ({ ...acc, [c.name]: c.value }), {})
    const base64 = cookiesMap.req;
    return base64 ? Buffer.from(base64, 'base64') : null
  }
  /**
   * @param {string[]} headers
   */
  const clientUnpack = (headers) => {
    const cookie = headers.find(h => {
      const [name] = h.split(':')
      return name.toLowerCase() === 'cookie'
    })
    if (!cookie) {
      return null
    }
    const cookiesMap = cookie.replace(/^cookie\:\s+/i, '')
      .split(/\;/g)
      .reduce((acc, c) => {
        const [name, value] = c.trim().split('=')
        acc[name] = value
        return acc
      }, {})
    const base64 = cookiesMap.sid
    return base64 ? Buffer.from(base64, 'base64') : null
  }
  /**
   * @param {Buffer} buffer
   */
  const unpack = (buffer) => {
    const headerStr = buffer.toString('utf-8')
    const headers = headerStr.split(/\r?\n/g)
    if (!headers.length) {
      return buffer
    }
    const isServer = headers[0].toLowerCase().startsWith('http/')
    const encoded = isServer ? serverUnpack(headers) : clientUnpack(headers)
    if (!encoded) {
      return buffer
    }
    const data = aes.decode(encoded)
    return msgpackr.unpack(data)
  }
  return { pack, unpack }
}

const client = createPacker({ isClient: true })
const server = createPacker({ isClient: false })

module.exports = { createPacker, client, server }
