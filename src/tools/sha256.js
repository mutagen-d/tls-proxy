const crypto = require('crypto')

const sha256 = (buffer) => {
  if (!buffer) {
    return null
  }
  return crypto.createHash('sha256').update(buffer).digest()
}

module.exports = { sha256 }