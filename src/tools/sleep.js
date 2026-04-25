/** @param {number} [ms] */
const sleep = (ms = 10) => {
  let timer
  /** @type {Promise<void> & { stop: () => void }} */
  const promise = new Promise(resolve => {
    timer = setTimeout(resolve, ms)
  })
  promise.stop = () => clearTimeout(timer)
  return promise
}

module.exports = { sleep }
