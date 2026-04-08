const { Transform } = require('stream');
const { TlsPacket } = require('./tls-packet');

class TLSRecordParser extends Transform {
  constructor(options = {}) {
    super(options);
    this.buffer = Buffer.alloc(0);
    this.handshakeComplete = false;
  }

  _transform(chunk, encoding, callback) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const [leftoverBytes, packets] = TlsPacket.from(this.buffer);
    const consumed = this.buffer.length - leftoverBytes;
    if (consumed >= 0) {
      this.buffer = this.buffer.slice(consumed);
    }
    // Forward raw chunk downstream immediately (passthrough behavior).
    this.push(chunk, encoding);
    callback();
  }

  _flush(callback) {
    if (this.buffer.length > 0) {
      this.push(this.buffer);
      this.buffer = Buffer.alloc(0);
    }
    callback();
  }
}

module.exports = { TLSRecordParser };
