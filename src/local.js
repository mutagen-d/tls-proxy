const net = require('net')
const crypto = require('crypto')
const ss = require('socket.io-stream')
const { createProxyServer } = require('@mutagen-d/node-proxy-server')
const { config } = require('./config')
const { connect } = require('./socket.io/io-client')
const { getAddress } = require('./tools/get-address')
const { Defer } = require('./tools/defer')
const { FakeTls } = require('./tls-parser/fake-tls')
const { createLogger } = require('./tools/logger')
const { fetchIP } = require('./tools/fetch-ip')
const { Duration } = require('./tools/duration')

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
    const duration = new Duration()
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
    const dstKey = `${dstHost}:${dstPort}`
    const id = crypto.randomUUID()
    logger.log(`proxy: ${id} ${dstKey} ${isTls ? '(tls)' : ''}`)
    //
    const remoteKey = `${config.remote.host}:${config.remote.port}`
    const socket = net.createConnection(config.remote.port, config.remote.host)
    const def1 = new Defer()
    socket.on('connect', () => {
      def1.resolve()
      logger.log(`tcp connected: ${id} ${remoteKey}`)
    })
    socket.on('error', (err) => {
      def1.reject(err)
      logger.log(`tcp error: ${id} ${remoteKey}`, err)
    })
    const def2 = new Defer()
    ws.emit('proxy-connect', { dstHost, dstPort, id }, (err) => {
      if (err) {
        logger.log('proxy-connect Error:', id, dstKey, err)
        def2.reject(err)
        socket.destroy()
      } else {
        logger.log('proxy-connect done', id, dstKey)
        def2.resolve()
      }
    })
    await def1.promise
    const address = getAddress(socket)
    const srcPort = address.local.port
    const srcHost = await fetchIP()
    // 2026-04-22: дожидаемся, пока установится соединение
    await def2.promise
    const def3 = new Defer()
    ws.emit('proxy-attach', { id, srcHost, srcPort }, (err) => {
      if (err) {
        logger.log('proxy-attach Error:', err)
        def3.reject(err)
        socket.destroy()
      } else {
        logger.log('proxy-attach done', dstKey)
        def3.resolve()
      }
    })
    await Promise.all([def2.promise, def3.promise])
    logger.log(`fake-tls: ${JSON.stringify({ fakeSni: config.fakeHost, realSni: dstHost })}`, duration.format())
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