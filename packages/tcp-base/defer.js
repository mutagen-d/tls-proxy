/** @template T */
class Defer {
  constructor() {
    /** @type {Promise<T>} */
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject
    })
  }
}

module.exports = { Defer }