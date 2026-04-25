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
const { SocketBase } = require('./net/socket-base')
const { client } = require('./net/packer')

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
    logger.log(`${id} PROXY ${dstKey} ${isTls ? '(tls)' : ''}`)
    //
    const remoteKey = `${config.remote.host}:${config.remote.port}`
    const socket = net.createConnection(config.remote.port, config.remote.host)
    const def1 = new Defer()
    socket.once('connect', () => {
      def1.resolve()
      logger.log(`${id} TCP connected ${remoteKey} (${dstKey})`)
    })
    socket.once('error', (err) => {
      def1.reject(err)
      logger.log(`${id} TCP error ${remoteKey} (${dstKey})`, err)
    })
    socket.once('close', () => {
      logger.log(`${id} TCP closed ${remoteKey} (${dstKey}) ${duration.format()}`)
    })
    const def2 = new Defer()
    ws.emit('proxy-connect', { dstHost, dstPort, id }, (err) => {
      if (err) {
        logger.log(`${id} PROXY connect Error (${dstKey}):`, err)
        def2.reject(err)
        socket.destroy()
      } else {
        logger.log(`${id} PROXY connect Done (${dstKey})`)
        def2.resolve()
      }
    })
    await def1.promise

    if (config.proxyAttach === 'tcp') {
      const sb = new SocketBase(socket, client)
      sb.connected = true
      const def3 = new Defer()
      sb.emit('proxy-attach', { dstHost, dstPort, id }, (err) => {
        sb.detach()
        err ? def3.reject(err) : def3.resolve()
      })
      await Promise.all([def2.promise, def3.promise])
      logger.log(`${id} fake-tls: ${JSON.stringify({ fakeSni: config.fakeHost, realSni: dstHost })}`, duration.format())
      const fakeTls = new FakeTls(socket, {
        fakeSni: config.fakeHost,
        realSni: dstHost,
      })
      return fakeTls
    }
    const address = getAddress(socket)
    const srcPort = address.local.port
    logger.log('TCP address:', JSON.stringify(address.local))
    const srcHost = await fetchIP()
    // 2026-04-22: дожидаемся, пока установится соединение
    // await def2.promise
    const def3 = new Defer()
    ws.emit('proxy-attach', { id, srcHost, srcPort }, (err) => {
      if (err) {
        logger.log(`${id} PROXY attach Error (${dstKey}):`, err)
        def3.reject(err)
        socket.destroy()
      } else {
        logger.log(`${id} PROXY attach Done (${dstKey})`)
        def3.resolve()
      }
    })
    await Promise.all([def2.promise, def3.promise])
    logger.log(`${id} fake-tls: ${JSON.stringify({ fakeSni: config.fakeHost, realSni: dstHost })}`, duration.format())
    const fakeTls = new FakeTls(socket, {
      fakeSni: config.fakeHost,
      realSni: dstHost,
    })
    logger.log(`${id} fake-tls ${fakeTls}`)
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