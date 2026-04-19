const EventEmitter = require('events')
const { TlsPacket } = require('./tls-packet')
const { createLogger } = require('../tools/logger')
const { config } = require('../config')

let index = 0
class TlsParser extends EventEmitter {
  /** @param {string} [sni] */
  constructor(sni) {
    super()
    index += 1
    /** @private */
    this.sni = sni
    this.id = index.toString().padStart(6, '0')
    this.logger = createLogger(`TLS:${this.id}${sni ? `|${sni}` : ''}`)
    if (config.appEnv === 'production') {
      this.logger.disable()
    }
    /** @type {Buffer} */
    this.buffer = Buffer.alloc(0)
    this.clientHelloDone = false
    this.serverHelloDone = false
    this.handshakeDone = false
    /** @private */
    this.handshakeTypes = [
      'Handshake',
      'ChangeCipherSpec',
    ]
    this.on('handshake_complete', () => {
      this.logger.log('Handshake Complete')
    })
  }

  /**
   * @private
   * @param {TlsPacket} packet
   */
  onPacket(packet) {
    if (!packet) {
      return
    }
    if (this.sni && packet.isClientHello()) {
      packet.setSni(this.sni)
    }
    this.emit('packet', packet)
    const prev = this.handshakeDone
    this.handshakeDone = !this.handshakeTypes.includes(packet.contentType.name)
    if (!prev && this.handshakeDone) {
      this.emit('handshake_complete')
    }
    if (packet.isClientHello()) {
      this.logger.log('CLIENT_HELLO DONE')
      this.clientHelloDone = true
    } else if (packet.isServerHello()) {
      this.logger.log('SERVER_HELLO DONE')
      this.serverHelloDone = true
    }
  }

  flush() {
    if (!this.buffer.length) {
      return
    }
    const buffer = this.buffer
    this.buffer = Buffer.alloc(0)
    return buffer
  }

  parse(chunk) {
    let buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk
    const records = []
    while (buffer.length >= 5) {
      // const contentType = buffer[0];
      // const version = buffer.readUInt16BE(1);
      const length = buffer.readUInt16BE(3);
      
      if (buffer.length < 5 + length) {
        break; // Wait for more data
      }
      const packet = TlsPacket.parse(buffer.slice(0, 5 + length))
      const i = records.length
      records.push(packet)
      this.onPacket(packet)
      const sni = packet.getSni()
      this.logger.log(`[${i}] packet`, packet.contentType.name, packet.body.value?.map(h => h.type.name), packet.body.buffer.length, sni || '')

      buffer = buffer.slice(5 + length);
    }
    this.buffer = buffer
    const i = records.length
    this.logger.log(`[${i}] leftOverLen`, this.buffer.length)
    return records
  }
}

module.exports = { TlsParser }
