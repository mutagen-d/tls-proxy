const crypto = require('crypto')

/**
 * @param {number | number[]} minSize 
 * @param {number} [maxSize]
 */
const randomBytes = (minSize, maxSize) => {
  if (Array.isArray(minSize)) {
    const index = crypto.randomInt(minSize.length)
    const size = minSize[index]
    return crypto.randomBytes(size)
  }
  maxSize = typeof maxSize === 'number' ? maxSize : minSize;
  const size = minSize === maxSize
    ? minSize
    : Math.floor(Math.random() * maxSize + minSize);
  return crypto.randomBytes(size)
}

/**
 * 
 * @param {{
 *  secret: string
 *  ivLength?: number
 *  algorithm?: string
 * } | string} config 
 * @returns 
 */
const aes = (config) => {
  config = typeof config === 'string' ? { secret: config } : (config || {})
  config.algorithm ||= 'aes-256-gcm'
  config.ivLength ||= 16
  if (!config.secret) {
    throw new Error('AES_SECRET required')
  }
  const KEY = crypto.createHash('sha256').update(config.secret).digest()
  const encode = (buffer) => {
    const iv = crypto.randomBytes(config.ivLength);
    const key = KEY

    const cipher = crypto.createCipheriv(config.algorithm, key, iv);

    const data = [
      iv,
      cipher.update(buffer),
      cipher.final(),
    ]
    const isGCM = config.algorithm.includes('gcm')
    if (isGCM) {
      // For GCM, remove if using different algorithm
      const authTag = cipher.getAuthTag()
      data.push(authTag)
    }
    // For authenticated encryption like GCM, get auth tag
    const encoded = Buffer.concat(data)
    return encoded
  }
  /** @param {Buffer} buffer */
  const decode = (buffer) => {
    // Extract IV from beginning of buffer
    const iv = buffer.slice(0, config.ivLength);

    const authTagSize = 16;
    const isGCM = config.algorithm.includes('gcm')

    // For GCM: extract auth tag from end
    let authTag = isGCM ? buffer.slice(-authTagSize) : null;
    const encryptedData = isGCM ? buffer.slice(config.ivLength, -authTagSize) : buffer.slice(config.ivLength);

    const key = KEY

    const decipher = crypto.createDecipheriv(config.algorithm, key, iv);

    // Set auth tag for GCM verification
    if (isGCM) {
      decipher.setAuthTag(authTag);
    }

    const decoded = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(),
    ]);

    return decoded;
  }
  return {
    randomBytes,
    encode,
    decode,
  }
}

aes.randomBytes = randomBytes

module.exports = { aes }
