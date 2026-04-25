const crypto = require('crypto')

/**
 * buffer sized
 */
const bufs = {
  /**
   * @param {Buffer} buffer
   * @param {number} [paddingSize]
   */
  encode: (buffer, paddingSize = 0) => {
    const size = buffer.length
    const payload = Buffer.alloc(4 + Math.max(buffer.length, paddingSize))
    payload.writeUint32BE(size)
    buffer.copy(payload, 4)
    if (paddingSize > buffer.length) {
      const rnd = crypto.randomBytes(paddingSize - buffer.length)
      rnd.copy(payload, 4 + buffer.length)
    }
    return payload
  },
  /**
   * @param {Buffer} data
   */
  decode: (data) => {
    if (data.length < 4) {
      throw new Error('invalid length')
    }
    const size = data.readUint32BE()
    if (data.length < 4 + size) {
      throw new Error('invalid payload')
    }
    return data.slice(4, 4 + size)
  }
}

module.exports = { bufs }