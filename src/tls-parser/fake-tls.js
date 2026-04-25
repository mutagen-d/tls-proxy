const { Transform } = require('stream')
const { TlsParser } = require('./tls-parser')
const { config } = require('../config')

class FakeTls extends Transform {
  /**
   * @param {import('stream').Duplex} stream
   * @param {import('stream').TransformOptions & {
   *  fakeSni?: string
   *  realSni?: string
   * }} [options]
   */
  constructor(stream, options) {
    super(options)
    options = options || {}
    /** @private */
    this.stream = stream
    /** @private */
    this._fakeSni = options.fakeSni || config.host
    /** @private */
    this._realSni = options.realSni
    this.fake = this._fakeSni ? new TlsParser(this._fakeSni) : null
    this.real = this._realSni ? new TlsParser(this._realSni) : null
    this._onData = this._onData.bind(this)
    this.stream.on('data', this._onData)
    this.stream.once('close', () => {
      this.stream.off('data', this._onData)
      this.destroy()
    })
    this.once('close', () => {
      this.stream.destroy()
    })
  }

  toString() {
    const proto = Object.getPrototypeOf(this)
    const ctor = proto && proto.constructor || proto
    return `[object ${ctor ? ctor.name : 'FakeTls'}]`
  }

  toJSON() {
    return {
      realSni: this._realSni,
      fakeSni: this._fakeSni,
    }
  }

  /** @private */
  _onData(chunk) {
    if (this.destroyed || this.closed) {
      return
    }
    if (this.isRealDone || this.real.isTls === false) {
      const buffer = this.real.buffer.length ? Buffer.concat([this.real.flush(), chunk]) : chunk
      this.push(buffer)
      return
    }
    const packets = this.real.parse(chunk)
    if (!this.real.isTls) {
      const buffer = this.real.buffer.length ? Buffer.concat([this.real.flush(), chunk]) : chunk
      this.push(buffer)
      return
    }
    if (packets.length) {
      const buffer = Buffer.concat(packets.map(v => v.toBuffer()))
      this.push(buffer)
    }
  }

  get isFakeDone() {
    return this.fake.clientHelloDone
      || this.fake.serverHelloDone
      || this.fake.handshakeDone
  }

  get isRealDone() {
    return this.real.clientHelloDone
      || this.real.serverHelloDone
      || this.real.handshakeDone
  }

  _transform(chunk, encoding, callback) {
    try {
      if (this.stream.destroyed || this.stream.closed) {
        return callback()
      }
      if (this.isFakeDone || this.fake.isTls === false) {
        const buffer = this.fake.buffer.length ? Buffer.concat([this.fake.flush(), chunk]) : chunk
        const ready = this.stream.write(buffer)
        if (ready) {
          return callback()
        }
        this.stream.once('drain', () => callback())
        return
      }
      const packets = this.fake.parse(chunk, encoding)
      if (!this.fake.isTls) {
        const buffer = this.fake.buffer.length ? Buffer.concat([this.fake.flush(), chunk]) : chunk
        const ready = this.stream.write(buffer)
        if (ready) {
          return callback()
        }
        this.stream.once('drain', () => callback())
        return
      }
      if (!packets.length) {
        return callback()
      }
      const buffer = Buffer.concat(packets.map(p => p.toBuffer()))
      const ready = this.stream.write(buffer)
      if (ready) {
        return callback()
      }
      this.stream.once('drain', () => callback())
    } catch (e) {
      callback(e)
    }
  }

  _flush(callback) {
    if (!this.fake.buffer.length) {
      return callback()
    }
    const ready = this.stream.write(this.fake.buffer)
    this.fake.buffer = Buffer.alloc(0)
    if (ready) {
      return callback()
    }
    this.stream.once('drain', () => callback())
  }
}

module.exports = { FakeTls }