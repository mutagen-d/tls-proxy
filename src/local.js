const net = require('net')
const ss = require('socket.io-stream')
const { createProxyServer } = require('@mutagen-d/node-proxy-server')
const { config } = require('./config')
const { connect } = require('./socket.io/io-client')
const { getAddress } = require('./tools/get-address')
const { Defer } = require('./tools/defer')
const { FakeTls } = require('./tls-parser/fake-tls')
const { createLogger } = require('./tools/logger')
const { fetchIP } = require('./tools/fetch-ip')

const blackList = config.blackList || []
const directList = config.directList || []

/**
 * @param {string} host 
 * @param {string[]} list 
 */
const isMatch = (host, list) => {
  if (!host) {
    return false
  }
  return list.includes(host) || list.some(h => host.endsWith(h))
}

const logger = createLogger('local')
const ws = connect()
const server = createProxyServer({
  createProxyConnection: async (opts, req) => {
    const { dstHost, dstPort } = opts
    if (isMatch(dstHost, blackList)) {
      throw new Error('forbidden')
    }
    if (isMatch(dstHost, directList)) {
      const sock = net.createConnection(dstPort, dstHost)
      const defer = new Defer()
      sock.on('connect', () => defer.resolve())
      sock.on('error', (err) => defer.reject(err))
      await defer.promise
      return sock
    }
    const isHttp = Boolean(req && req.method)
    const isTls = isHttp && req.method.toLowerCase() === 'connect' && dstPort !== 80;
    if (dstPort === 80) {
      const defer = new Defer()
      const stream = ss.createStream()
      ss(ws).emit('proxy-stream', stream, opts, (err) => {
        return err ? defer.reject(err) : defer.resolve()
      })
      await defer.promise
      return stream
    }
    const socket = net.createConnection(config.remote.port, config.remote.host)
    const dstKey = `${dstHost}:${dstPort}`
    logger.log(`proxy: ${dstKey} ${isTls ? '(tls)' : ''}`)
    const connDefer = new Defer()
    socket.on('connect', () => connDefer.resolve())
    socket.on('error', (err) => connDefer.reject(err))
    await connDefer.promise
    const address = getAddress(socket)
    const srcPort = address.local.port
    const srcHost = await fetchIP()
    const defer = new Defer()
    ws.emit('proxy-connection', { dstHost, dstPort, srcHost, srcPort }, (err) => {
      if (err) {
        logger.log('proxy-error', err)
        defer.reject(err)
        socket.destroy()
      } else {
        logger.log('proxy-connected', dstKey)
        defer.resolve()
      }
    })
    await defer.promise
    logger.log(`fakeTLS: ${JSON.stringify({ fakeSni: config.fakeHost, realSni: dstHost })}`)
    const fakeTls = new FakeTls(socket, {
      fakeSni: config.fakeHost,
      realSni: dstHost,
    })
    return fakeTls
  }
})

server.on('error', (err) => logger.log('ERROR:', err))
server.listen(config.local.port, '0.0.0.0', () => logger.log('server listening port', config.local.port))

const wsproxy = createProxyServer({
  createProxyConnection: async (opts) => {
    const defer = new Defer()
    const stream = ss.createStream()
    ss(ws).emit('proxy-stream', stream, opts, (err) => {
      return err ? defer.reject(err) : defer.resolve()
    })
    await defer.promise
    return stream
  }
})

const port = +config.local.port + 1
wsproxy.on('error', (err) => logger.log('ERROR:', err))
wsproxy.listen(port, '0.0.0.0', () => logger.log('server listening port', port, '(ws)'))