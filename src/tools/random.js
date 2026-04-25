const crypto = require('crypto')

/**
 * @param {number} min
 * @param {number} max
 * @returns 
 */
const random = (min, max) => {
  const rnd = crypto.randomInt(Math.max(1, Math.round(max - min)))
  return min + rnd
}

module.exports = { random }
