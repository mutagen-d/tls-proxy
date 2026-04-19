const { getHandshakeType, getExtensionType } = require('./constants')
const { TlsClientHello } = require('./tls-client-hello')
const { TlsServerHello } = require('./tls-server-hello')

/**
 * @typedef {ReturnType<TlsHandshake.parseDto>} ITlsHandshakeDto
 */

class TlsHandshake {
  /** @type {ITlsHandshakeDto['type']} */
  type
  /** @type {ITlsHandshakeDto['body']} */
  body

  /**
   * @param {Partial<ITlsHandshakeDto>} [params]
   */
  constructor(params) {
    Object.assign(this, params)
  }

  getHandshakeType() {
    return this.type.name || getHandshakeType(this.type.value)
  }

  toJSON() {
    return {
      type: this.type,
      body: this.body.value,
      bodyLen: this.body.buffer.length,
    }
  }

  getSni() {
    const ext = this.getExtension('server_name')
    return ext ? ext.getSni() : null
  }

  /** @param {string} newSni */
  setSni(newSni) {
    const ext = this.getExtension('server_name')
    return ext ? ext.setSni(newSni) : false
  }

  /**
   * @param {number | Exclude<ReturnType<getExtensionType>, 'Unknown'>} extType 
   */
  getExtension(extType) {
    const msgTypeName = this.type.name;
    if (!this.body.value) {
      return null
    }
    if (msgTypeName !== 'ClientHello' && msgTypeName !== 'ServerHello') {
      return null
    }
    const ext = this.body.value.extensions.value.find(ex => {
      return typeof extType === 'number' ? ex.type.value === extType : ex.type.name === extType
    })
    return ext
  }

  toBuffer(simplified = false) {
    if (simplified) {
      const msgBody = this.body.buffer
      const length = msgBody.length
      const header = Buffer.alloc(4)
      header.writeUInt8(this.type.value, 0)
      header.writeUIntBE(length, 1, 3)
      return Buffer.concat([header, msgBody])
    }
    const msgBody = this.body.value?.toBuffer ? this.body.value.toBuffer() : this.body.buffer
    const length = msgBody.length
    const header = Buffer.alloc(4)
    header.writeUInt8(this.type.value, 0)
    header.writeUIntBE(length, 1, 3)
    return Buffer.concat([header, msgBody])
  }

  /**
   * @param {Buffer} fragment
   */
  static parse(fragment) {
    /** @type {TlsHandshake[]} */
    const records = []
    // Simplified handshake parser - parse ClientHello/ServerHello
    let offset = 0;
    while (offset < fragment.length) {
      const msgType = fragment[offset];
      const length = fragment.readUIntBE(offset + 1, 3);
      
      if (offset + 4 + length > fragment.length) break;

      const msgBody = fragment.slice(offset + 4, offset + 4 + length);
      const handshakeDto = TlsHandshake.parseDto(msgType, msgBody)
      const handshake = new TlsHandshake(handshakeDto)
      
      records.push(handshake)
      offset += 4 + length;
    }
    return records
  }

  /**
   * @param {number} msgType
   * @param {Buffer} msgBody
   */
  static parseDto(msgType, msgBody) {
    const msgTypeName = getHandshakeType(msgType)
    let value
    if (msgTypeName === 'ClientHello') {
      value = TlsClientHello.parse(msgBody)
    }
    if (msgTypeName === 'ServerHello') {
      value = TlsServerHello.parse(msgBody)
    }
    const handshake = {
      type: {
        value: msgType,
        name: msgTypeName,
      },
      body: {
        buffer: msgBody,
        value,
      }
    }
    return handshake
  }
}

module.exports = { TlsHandshake }
