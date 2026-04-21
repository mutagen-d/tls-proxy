const crypto = require('crypto')
const { config } = require('../config')

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
 * @param {string} [secret]
 */
const createAES = (secret) => {
  secret ||= config.aes?.secret
  const key = crypto.createHash('sha256').update(secret).digest()
  const ivLength = config.aes?.ivLength ?? 16
  const algorithm = config.aes?.algorithm ?? 'aes-256-gcm'

  const encode = (buffer) => {
    const iv = crypto.randomBytes(ivLength);

    const cipher = crypto.createCipheriv(algorithm, key, iv);

    const data = [
      iv,
      cipher.update(buffer),
      cipher.final(),
    ]
    const isGCM = algorithm.includes('gcm')
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
    const iv = buffer.slice(0, ivLength);

    const authTagSize = 16;
    const isGCM = algorithm.includes('gcm')

    // For GCM: extract auth tag from end
    let authTag = isGCM ? buffer.slice(-authTagSize) : null;
    const encryptedData = isGCM ? buffer.slice(ivLength, -authTagSize) : buffer.slice(ivLength);

    const decipher = crypto.createDecipheriv(algorithm, key, iv);

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
  return { encode, decode, randomBytes }
}

const aes = createAES()

module.exports = { aes, createAES }
