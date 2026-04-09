const { Transform } = require('stream')

/**
 * @template T
 * @param {T} value
 */
const noop = (value) => value
class EncryptedStream extends Transform {
  /**
   * @param {import('stream').Duplex} stream
   * @param {import('stream').TransformOptions & {
   *  encode?: (chunk: any) => any
   *  decode?: (chunk: any) => any
   *  encrypted?: boolean
   * }} [options]
   */
  constructor(stream, options) {
    super(options)
    options = options || {}
    /** @private */
    this.stream = stream
    /** @private */
    this._encode = options.encode || noop
    /** @private */
    this._decode = options.decode || noop
    /** @private */
    this._encrypted = typeof options.encrypted === 'boolean' ? options.encrypted : true
    this._onData = this._onData.bind(this)
    // Buffer for assembling framed incoming messages
    this._recvBuffer = Buffer.alloc(0)
    this.stream.on('data', this._onData)
    this.stream.once('close', () => this.stream.off('data', this._onData))
  }

  /** @private */
  _onData(chunk) {
    // Append to receive buffer and process any complete frames.
    this._recvBuffer = Buffer.concat([this._recvBuffer, Buffer.from(chunk)])

    // Frame format: 4-byte BE length prefix, followed by payload
    while (this._recvBuffer.length >= 4) {
      const len = this._recvBuffer.readUInt32BE(0)
      if (this._recvBuffer.length >= 4 + len) {
        const frame = this._recvBuffer.slice(4, 4 + len)
        try {
          const decoded = this.decode(frame)
          this.push(decoded)
        } catch (e) {
          // Emit error so callers can handle authentication failures
          this.emit('error', e)
        }
        this._recvBuffer = this._recvBuffer.slice(4 + len)
      } else {
        break
      }
    }
  }

  _transform(chunk, encoding, callback) {
    try {
      // Encode and send as a framed message: [len(4)][payload]
      const payload = Buffer.from(this.encode(chunk, encoding))
      const header = Buffer.alloc(4)
      header.writeUInt32BE(payload.length, 0)
      this.stream.write(Buffer.concat([header, payload]))
      callback()
    } catch (e) {
      callback(e)
    }
  }

  encryption(encrypted = true) {
    this._encrypted = Boolean(encrypted)
  }

  /** @private */
  encode(chunk, encoding) {
    return this._encrypted ? this._encode(Buffer.from(chunk, encoding)) : chunk
  }

  /** @private */
  decode(chunk) {
    return this._encrypted ? this._decode(chunk) : chunk
  }
}

module.exports = { EncryptedStream }