const { Transform } = require('stream');
const { TlsParser } = require('./tls-parser');

class TlsStream extends Transform {
  /**
   * @param {string} [sni]
   * @param {import('stream').TransformOptions & { parser?: TlsParser }} [options]
   */
  constructor(sni, options = {}) {
    options = options || {}
    super(options);
    /** @protected */
    this.tls = options.parser || new TlsParser(sni)
    /** @protected */
    this.sni = sni
  }

  _transform(chunk, encoding, callback) {
    if (this.tls.handshakeComplete) {
      this.push(chunk, encoding)
      callback()
      return
    }
    const packets = this.tls.parse(chunk)
    if (packets.length) {
      const buffer = Buffer.concat(...packets.map(p => p.toBuffer()))
      this.push(buffer)
    }
    callback()
  }

  _flush(callback) {
    if (this.tls.buffer.length > 0) {
      this.push(this.tls.buffer);
      this.tls.buffer = Buffer.alloc(0);
    }
    callback();
  }
}

module.exports = { TlsStream };
