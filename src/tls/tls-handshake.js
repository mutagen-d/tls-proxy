const { HANDSHAKE_TYPES } = require("./constants")
const { TlsClientHello } = require("./tls-client-hello")
const { TlsServerHello } = require("./tls-server-hello")

class TlsHandshake {
  /** 
   * - `1` - ClientHello
   * - `2` - ServerHello
   * @type {number} */
  msgType
  /** @type {ReturnType<typeof TlsHandshake.getMsgTypeName>} */
  msgTypeName
  /** @type {Buffer} */
  msgBody
  /** @type {any} */
  parsed

  /**
   * @param {Partial<TlsHandshake>} [params]
   */
  constructor(params) {
    Object.assign(this, params)
  }

  toJSON() {
    return {
      msgType: this.msgType,
      msgTypeName: this.msgTypeName,
      msgBodyLength: this.msgBody.length,
      parsed: this.parsed,
    }
  }

  /**
   * @param {Buffer} fragment
   */
  static from(fragment) {
    /** @type {TlsHandshake[]} */
    const records = []
    // Simplified handshake parser - parse ClientHello/ServerHello
    let offset = 0;
    while (offset < fragment.length) {
      const msgType = fragment[offset];
      const length = fragment.readUIntBE(offset + 1, 3);
      
      if (offset + 4 + length > fragment.length) break;
      
      const msgBody = fragment.slice(offset + 4, offset + 4 + length);
      const handshake = new TlsHandshake({
        msgType,
        msgTypeName: TlsHandshake.getMsgTypeName(msgType),
        msgBody,
      })
      if (handshake.msgTypeName === 'ClientHello') {
        handshake.parsed = TlsClientHello.from(msgBody)
      }
      if (handshake.msgTypeName === 'ServerHello') {
        handshake.parsed = TlsServerHello.from(msgBody)
      }
      records.push(handshake)
      
      offset += 4 + length;
    }
    return records
  }

  static getMsgTypeName(msgType) {
    /** @type {HANDSHAKE_TYPES[keyof typeof HANDSHAKE_TYPES]} */
    const type = HANDSHAKE_TYPES[msgType]
    /** @type {`Unknown${number}`} */
    const unknown = `Unknown${msgType}`
    return type || unknown
  }
}

module.exports = { TlsHandshake }
