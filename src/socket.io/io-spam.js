const crypto = require('crypto')

const createSpamer = (timer) => {
  /**
   * @param {import('socket.io').Socket | import('socket.io-client').Socket} socket
   */
  const start = (socket) => {
    const timeout = crypto.randomInt(20_000) + 5_000
    clearTimeout(timer)
    timer = setTimeout(() => {
      const event = crypto.randomBytes(16).toString('hex')
      const size = crypto.randomInt(384) + 122;
      socket.emit(event, [crypto.randomBytes(size)])
      start(socket)
    }, timeout)
  }
  const stop = () => clearTimeout(timer)
  return { start: start, stop }
}

module.exports = { createSpamer }
