const crypto = require('crypto')
const { aes } = require('./aes')

const LF = '\n'.charCodeAt(0)
const CR = '\r'.charCodeAt(0)
const SEP = '\r\n'

/** @type {Buffer} */
let UNAUTH_BUFFER
const UNAUTH = () => UNAUTH_BUFFER
{
  const html = `<!DOCTYPE html><html>
  <head><title>Unauthorized</title></head>
  <body><h1>401 Unauthorized</h1></body>
</html>`
  const data = Buffer.from(html, 'utf-8')
  const headers = [
    'HTTP/1.1 401 Unauthorized',
    'Content-Type: text/html',
    `Content-Length: ${data.length}`,
    SEP,
  ]
  UNAUTH_BUFFER = Buffer.concat([Buffer.from(headers.join(SEP)), data])
}

/**
 * 
 * @param {string} host
 * @param {string} [url]
 * @param {'308' | '302'} statusCode 
 * @returns 
 */
const REDIRECT = (host, url, statusCode = '308') => {
  host ||= 'example.com'
  try {
    const uri = new URL(url || '/', `https://${host}`)
    url = uri.href
  } catch (e) {
    console.log(e)
  }
  const headers = [
    `HTTP/1.1 ${statusCode}`,
    `Location: ${url}`,
    SEP,
  ]
  const buffer = Buffer.from(headers.join(SEP), 'utf-8')
  return buffer
}
/**
 * @param {Buffer} data 
 */
const findHeaderEnd = (data) => {
  for (let i = 0; i < data.byteLength; ++i) {
    if (data[i] === LF && data[i + 1] === LF) {
      return i + 2
    }
    if (data[i] === LF && data[i + 1] === CR && data[i + 2] === LF) {
      return i + 3
    }
  }
  return -1
}
const randomMethod = () => {
  /** @type {['GET', 'POST', 'PUT', 'PATCH']} */
  const methods = [
    'GET',
    'POST',
    'PUT',
    'PATCH',
  ]
  const index = crypto.randomInt(methods.length)
  const method = methods[index]
  return method
}
const randomUrl = () => {
  const size = Math.floor(Math.random() * 10) + 5;
  const id = crypto.randomBytes(size).toString('hex')
  /** @type {['images', 'videos', 'users']} */
  const names = [
    'images',
    'videos',
    'users',
    'files',
  ]
  const index = crypto.randomInt(names.length)
  const name = names[index]
  if (crypto.randomInt(10) < 5) {
    /** @type {`/api/${name}/${id}`} */
    const url = `/api/${name}/${id}`
    return url
  }
  /** @type {`/api/${name}`} */
  const url = `/api/${name}`
  return url
}
/**
 * @param {string | {
 *  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'HEAD'
 *  contentLength?: number | string
 *  userAgent?: string
 * }} [options]
 */
const getRequestHeaders = (options) => {
  options = typeof options === 'string' ? { host: options } : (options || {})
  const host = options.host || 'example.com';
  const method = options.method || randomMethod()
  const userAgent = options.userAgent || 'curl/7.81.0'
  const headers = [
    `${method} ${randomUrl()} HTTP/1.1`,
    `Host: ${host}`,
    `User-Agent: ${userAgent}`,
    'Content-Type: octet/stream',
    'Accept: */*',
  ]
  if (options.contentLength) {
    headers.push(`Content-Length: ${options.contentLength}`)
  }
  headers.push(SEP)
  return headers
}

const randomBytes = () => Buffer.concat([buffer, aes.randomBytes([122, 186, 212, 250, 286, 298, 310])])

/**
 * @param {Parameters<getRequestHeaders>[0]} [options]
 * @returns 
 */
const fakeHeader = (options) => {
  const buffer = Buffer.from(getRequestHeaders(options).join(SEP), 'utf-8')
  const serialize = (data) => {
    if (!data) {
      return Buffer.concat([buffer, randomBytes()])
    }
    return Buffer.concat([buffer, data])
  }
  const parse = (data) => {
    const index = findHeaderEnd(data)
    if (index >= 0) {
      return data.subarray(index)
    }
    return data
  }
  return {
    encode: serialize,
    decode: parse,
    unauth: UNAUTH,
    redirect: REDIRECT,
  }
}

module.exports = { fakeHeader }