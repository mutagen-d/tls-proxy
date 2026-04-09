const { unpack, pack } = require('msgpackr')

/** @type {IFilter} */
const NoopFilter = {
  encode: (data) => data,
  decode: (data) => data,
}
/**
 * @typedef {{
 *  encode: (data: Buffer) => Buffer
 *  decode: (data: Buffer) => Buffer
 * }} IFilter
 */

/**
 * create data packer
 * ```js
 * // encoding starts from the last filter: aes -> fakeHeader
 * // decoding starts from the first filter: fakeHeader -> aes
 * const packer = new Packer([
 *  fakeHeader('www.example.com'),
 *  aes(secretToken),
 * ])
 * ```
 */
class Packer {
  /**
   * @param {IFilter[]} [filters]
   */
  constructor(filters) {
    this.filters = filters || [NoopFilter]
  }

  /**
   * @param  {any[]} args
   */
  pack(...args) {
    const reversed = this.filters.slice().reverse()
    return reversed.reduce((res, filter) => {
      return filter.encode(res)
    }, pack(args))
  }

  /**
   * @param {Buffer} data
   * @return {any[]}
   */
  unpack(data) {
    const argsBuffer = this.filters.reduce((res, filter) => {
      return filter.decode(res)
    }, data)
    return unpack(argsBuffer)
  }
}

module.exports = { Packer }