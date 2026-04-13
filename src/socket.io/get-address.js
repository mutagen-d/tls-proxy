/**
 * @param {import('socket.io').Socket | import('socket.io-client').Socket} socket 
 */
const getAddress = (socket) => {
  /**
   * @type {{
   *  local?: { ip?: string; port?: number }
   *  remote?: { ip?: string; port?: number }
   * }}
   */
  const address = {}
  if (socket.io && socket.io.engine) {
    /** @type {import('socket.io-client').Socket} */
    const s = socket;
    const engine = s.io.engine;
    let rawSocket
    // and finally, the raw 'net.Socket' in Node.js.
    if (engine && engine.transport && engine.transport.ws) {
      // For WebSocket transport
      const underlyingWebSocket = engine.transport.ws;
      if (underlyingWebSocket && underlyingWebSocket._socket) {
        rawSocket = underlyingWebSocket._socket;
      }
    } else if (engine && engine.transport && engine.transport.polling && engine.transport.polling._socket) {
      // For HTTP polling transport (less common, but possible)
      rawSocket = engine.transport.polling._socket;
    }
    if (rawSocket) {
      address.local = {
        ip: rawSocket.localAddress,
        port: rawSocket.localPort,
      }
      address.remote = {
        ip: rawSocket.remoteAddress,
        port: rawSocket.remotePort,
      }
    }
  } else {
    const sock = socket.request.socket
    address.local = {
      ip: sock.localAddress,
      port: sock.localPort,
    }
    address.remote = {
      ip: sock.remoteAddress,
      port: sock.remotePort,
    }
  }
  Object.defineProperty(address, 'toString', {
    value: function () {
      const { local, remote } = this
      return JSON.stringify({ local, remote })
    },
    enumerable: false,
    configurable: true,
    writable: false,
  })
  return Object.freeze(address)
}

module.exports = { getAddress }