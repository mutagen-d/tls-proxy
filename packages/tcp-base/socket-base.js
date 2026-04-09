const net = require('net')
const tls = require('tls')
const crypto = require('crypto')
const EventEmitter = require('events');
const { Packer } = require('./packer');

const events = [
  'error',
  'removeListener',
  'newListener',
]

const AckResponseEvent = '$ack-response';

class SocketBase {
  /**
   * @param {import('net').Socket | import('tls').TLSSocket | import('net').NetConnectOpts | import('tls').TLSSocketOptions} socketOrOptions
   * @param {boolean | { isTLSOptions?: boolean; packer: import('./packer').Packer }} [extraOptions]
   * @param {import('./packer').Packer} [packer]
   */
  constructor(socketOrOptions, extraOptions = false, packer) {
    /** @type {import('net').Socket | import('tls').TLSSocket} */
    this.socket
    extraOptions = typeof extraOptions === 'boolean' ? { isTLSOptions: extraOptions } : (extraOptions || {})
    packer ||= extraOptions.packer || new Packer()
    /** @protected */
    this.packer = packer
    const isTLSOptions = extraOptions.isTLSOptions
    if (socketOrOptions instanceof net.Socket) {
      this.options = null
      this.socket = socketOrOptions
    } else if (socketOrOptions instanceof tls.TLSSocket) {
      this.options = null
      this.socket = socketOrOptions
    } else {
      this.socket = isTLSOptions ? tls.connect(socketOrOptions) : net.connect(socketOrOptions)
      this.options = socketOrOptions;
    }
    this.onData = this.onData.bind(this)
    this._onAck = this._onAck.bind(this)
    this._onError = this._onError.bind(this)
    this._onDisconnect = this._onDisconnect.bind(this)
    this._onConnect = this._onConnect.bind(this)

    /** @protected */
    this.events = new EventEmitter()
    /** @private */
    this.ackListeners = new Map()
    /** @private */
    this.ackCallbacks = new Map()

    this.events.on(AckResponseEvent, this._onAck)

    this.socket.on('data', this.onData)
    this.socket.on('error', this._onError)
    this.socket.on('close', this._onDisconnect)
    this.socket.on('connect', this._onConnect)

    this.disconnected = false;
    this.connected = false;

    /** @private */
    this._connectTimeout = null;
    this._reconnect = this._reconnect.bind(this)
    /** `0` to disable reconnect */
    this.reconnectTimeout = 0
  }

  detach() {
    this.socket.off('data', this.onData)
    this.socket.off('error', this._onError)
    this.socket.off('close', this._onDisconnect)
    this.socket.off('connect', this._onConnect)
  }

  /**
   * @param {Error} [error]
   */
  destroy(error) {
    this.socket.destroy(error)

    this.events.removeAllListeners()
    this.ackListeners.clear()
    this.ackCallbacks.clear()
    this.socket.removeAllListeners()
  }

  disconnect() {
    if (this.disconnected) {
      return;
    }
    this.destroy()
    this.disconnected = true;
  }

  /** @private */
  _onError(error, ...args) {
    if (error && error.code === 'ECONNREFUSED') {
      this.events.emit('connect_error', error)
      this._tryReconnect()
    } else {
      this.events.emit('error', error, ...args)
    }
  }

  /** @private */
  _tryReconnect() {
    clearTimeout(this._connectTimeout)
    this._connectTimeout = setTimeout(this._reconnect, this.reconnectTimeout)
  }

  /** @private */
  _reconnect() {
    if (this.options && this.reconnectTimeout) {
      this.socket.connect(this.options)
    }
  }

  /** @private */
  _onDisconnect() {
    if (this.connected) {
      this.events.emit('disconnect')
      this.connected = false
    }
    if (!this.disconnected) {
      this._tryReconnect()
    }
  }

  /** @private */
  _onAck(ack) {
    if (!ack || !ack.ackId || ack.type !== 'response') {
      return;
    }
    const callback = this.ackCallbacks.get(ack.ackId)
    if (typeof callback === 'function') {
      const args = ack.args || []
      callback(...args)
    }
  }

  /** @private */
  _onConnect() {
    this.events.emit('connect')
    this.connected = true
  }

  onData(data) {
    try {
      const [event, ...args] = this.packer.unpack(data)
      this.events.emit(event, ...args)
    } catch (e) {
      console.log('Warning!', e)
      this.emit('error', e)
    }
  }

  emit(event, ...args) {
    if (events.includes(event)) {
      // return super.emit(event, ...args)
      return this.events.emit(event, ...args)
    }
    if (args.length && typeof args[args.length - 1] === 'function') {
      /** @type {Function} */
      const callback = args[args.length - 1]
      const ackId = crypto.randomUUID()
      args[args.length - 1] = { ackId, type: 'request' }
      this.ackCallbacks.set(ackId, callback)
    }
    const data = this.packer.pack(event, ...args)
    this.socket.write(data)
  }

  on(event, listener) {
    const _listener = this.ackListeners.get(listener) || ((...args) => {
      const ack = args.length && args[args.length - 1];
      if (!ack || !ack.ackId || ack.type !== 'request') {
        return listener(...args)
      }
      const callback = (...args) => {
        this.emit(AckResponseEvent, {
          ackId: ack.ackId,
          type: 'response',
          args,
        })
      }
      args = args.slice(0, -1)
      return listener(...args, callback)
    })
    this.ackListeners.set(listener, _listener)
    this.events.on(event, _listener)
    const remove = () => {
      this.events.off(event, _listener)
    }
    return { remove }
  }

  once(event, listener) {
    const _listener = (...args) => {
      this.off(event, _listener)
      return listener(...args)
    }
    return this.on(event, _listener)
  }

  off(event, listener) {
    this.events.off(event, listener)
    const _listener = this.ackListeners.get(listener)
    if (typeof _listener) {
      this.events.off(event, _listener)
      this.ackListeners.delete(listener)
    }
  }
}

module.exports = { SocketBase }
