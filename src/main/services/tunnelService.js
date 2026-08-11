/**
 * DevsFTP SSH Tunneling & Port Forwarding Service
 * Supports:
 * 1. Local Port Forwarding (Local TCP Port -> SSH Client -> Remote Target)
 * 2. Remote Port Forwarding (Remote Server Port -> SSH Client -> Local Target)
 * 3. Dynamic SOCKS5 Proxying (Local SOCKS5 Server -> SSH Client -> Dynamic Outbound)
 */

const net = require('net');
const { Client } = require('ssh2');
const fs = require('fs');

class TunnelService {
  constructor() {
    this.tunnels = new Map(); // tunnelId -> tunnelObj
  }

  /**
   * Start an SSH Tunnel rule
   * @param {Object} rule - { id, name, type: 'local'|'remote'|'dynamic', localHost, localPort, remoteHost, remotePort, profileConfig }
   * @param {Function} onLog - Logger callback (type, message)
   */
  async startTunnel(rule, onLog = () => {}) {
    const tunnelId = rule.id || `tun_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    if (this.tunnels.has(tunnelId)) {
      const existing = this.tunnels.get(tunnelId);
      if (existing.status === 'active') {
        throw new Error(`Tunnel '${rule.name || tunnelId}' is already active.`);
      }
      await this.stopTunnel(tunnelId, onLog);
    }

    const tunnelObj = {
      id: tunnelId,
      rule: { ...rule, id: tunnelId },
      status: 'connecting',
      localServer: null,
      sshClient: null,
      activeConnections: 0,
      bytesRead: 0,
      bytesWritten: 0,
      startTime: Date.now(),
      error: null,
      activeSockets: new Set() // Track active sockets for graceful draining (Issue 8.1)
    };

    this.tunnels.set(tunnelId, tunnelObj);

    return new Promise((resolve, reject) => {
      onLog('info', `[SSH Tunnel] Establishing SSH transport connection for rule '${rule.name}' (${rule.type.toUpperCase()})...`);

      const sshClient = new Client();
      tunnelObj.sshClient = sshClient;

      sshClient.on('ready', () => {
        onLog('info', `[SSH Tunnel] SSH transport established to ${rule.profileConfig.host}:${rule.profileConfig.port || 22}`);

        if (rule.type === 'local') {
          this._startLocalForwarding(tunnelObj, onLog, resolve, reject);
        } else if (rule.type === 'remote') {
          this._startRemoteForwarding(tunnelObj, onLog, resolve, reject);
        } else if (rule.type === 'dynamic') {
          this._startDynamicSocksProxy(tunnelObj, onLog, resolve, reject);
        } else {
          tunnelObj.status = 'error';
          tunnelObj.error = `Unsupported tunnel type '${rule.type}'`;
          sshClient.end();
          reject(new Error(tunnelObj.error));
        }
      });

      sshClient.on('error', (err) => {
        onLog('error', `[SSH Tunnel Error] '${rule.name}': ${err.message}`);
        tunnelObj.status = 'error';
        tunnelObj.error = err.message;
        this.stopTunnel(tunnelId);
        reject(err);
      });

      sshClient.on('close', () => {
        if (tunnelObj.status === 'active' || tunnelObj.status === 'connecting') {
          onLog('warning', `[SSH Tunnel] Connection closed for '${rule.name}'`);
          tunnelObj.status = 'stopped';
        }
      });

      // Prepare SSH Connection Options
      const connectOpts = {
        host: rule.profileConfig.host,
        port: parseInt(rule.profileConfig.port || 22, 10),
        username: rule.profileConfig.username,
        keepaliveInterval: 10000,
        readyTimeout: 20000
      };

      if (rule.profileConfig.authType === 'key' && rule.profileConfig.privateKeyPath) {
        try {
          connectOpts.privateKey = fs.readFileSync(rule.profileConfig.privateKeyPath);
          if (rule.profileConfig.passphrase) connectOpts.passphrase = rule.profileConfig.passphrase;
        } catch (keyErr) {
          tunnelObj.status = 'error';
          tunnelObj.error = keyErr.message;
          return reject(new Error(`Failed to read SSH private key: ${keyErr.message}`));
        }
      } else {
        connectOpts.password = rule.profileConfig.password || '';
      }

      try {
        sshClient.connect(connectOpts);
      } catch (connErr) {
        tunnelObj.status = 'error';
        tunnelObj.error = connErr.message;
        reject(connErr);
      }
    });
  }

  /**
   * Local Port Forwarding: Listen on Local TCP Port and pipe to SSH forwardOut stream
   */
  _startLocalForwarding(tunnelObj, onLog, resolve, reject) {
    const { rule, sshClient } = tunnelObj;
    const localHost = rule.localHost || '127.0.0.1';
    const localPort = parseInt(rule.localPort, 10);
    const targetHost = rule.remoteHost || '127.0.0.1';
    const targetPort = parseInt(rule.remotePort, 10);

    const localServer = net.createServer((socket) => {
      tunnelObj.activeConnections++;
      tunnelObj.activeSockets.add(socket);
      socket.statsCleanedUp = false;

      onLog('info', `[SSH Tunnel] Local connection received on ${localHost}:${localPort}. Forwarding to ${targetHost}:${targetPort}...`);

      sshClient.forwardOut(
        socket.remoteAddress || '127.0.0.1',
        socket.remotePort || 0,
        targetHost,
        targetPort,
        (err, stream) => {
          if (err) {
            onLog('error', `[SSH Tunnel] ForwardOut error for ${targetHost}:${targetPort}: ${err.message}`);
            socket.destroy();
            if (!socket.statsCleanedUp) {
              socket.statsCleanedUp = true;
              tunnelObj.activeConnections = Math.max(0, tunnelObj.activeConnections - 1);
              tunnelObj.activeSockets.delete(socket);
            }
            return;
          }

          socket.on('data', (chunk) => { tunnelObj.bytesRead += chunk.length; });
          stream.on('data', (chunk) => { tunnelObj.bytesWritten += chunk.length; });

          socket.pipe(stream);
          stream.pipe(socket);

          const cleanup = () => {
            if (!socket.statsCleanedUp) {
              socket.statsCleanedUp = true;
              tunnelObj.activeConnections = Math.max(0, tunnelObj.activeConnections - 1);
              tunnelObj.activeSockets.delete(socket);
            }
          };

          socket.on('close', cleanup);
          stream.on('close', cleanup);
          socket.on('error', cleanup);
          stream.on('error', cleanup);
        }
      );
    });

    localServer.on('error', (err) => {
      onLog('error', `[SSH Tunnel Local Server Error] ${err.message}`);
      tunnelObj.status = 'error';
      tunnelObj.error = err.message;
      sshClient.end();
      reject(err);
    });

    localServer.listen(localPort, localHost, () => {
      tunnelObj.status = 'active';
      tunnelObj.localServer = localServer;
      onLog('info', `[SSH Tunnel Active] Local Port Forwarding live: ${localHost}:${localPort} ➔ ${rule.profileConfig.host} ➔ ${targetHost}:${targetPort}`);
      resolve({
        id: tunnelObj.id,
        status: 'active',
        localAddress: `${localHost}:${localPort}`,
        targetAddress: `${targetHost}:${targetPort}`
      });
    });
  }

  /**
   * Remote Port Forwarding: Register forwardIn on remote SSH server
   */
  _startRemoteForwarding(tunnelObj, onLog, resolve, reject) {
    const { rule, sshClient } = tunnelObj;
    const bindAddr = rule.remoteHost || '0.0.0.0';
    const bindPort = parseInt(rule.remotePort, 10);
    const targetLocalHost = rule.localHost || '127.0.0.1';
    const targetLocalPort = parseInt(rule.localPort, 10);

    sshClient.forwardIn(bindAddr, bindPort, (err) => {
      if (err) {
        onLog('error', `[SSH Tunnel Remote Error] ForwardIn failed on remote ${bindAddr}:${bindPort}: ${err.message}`);
        tunnelObj.status = 'error';
        tunnelObj.error = err.message;
        sshClient.end();
        return reject(err);
      }

      tunnelObj.status = 'active';
      onLog('info', `[SSH Tunnel Active] Remote Port Forwarding live: Remote ${bindAddr}:${bindPort} ➔ Local ${targetLocalHost}:${targetLocalPort}`);

      sshClient.on('tcp connection', (info, accept, rejectConn) => {
        tunnelObj.activeConnections++;
        onLog('info', `[SSH Tunnel] Incoming remote connection from ${info.srcIP}:${info.srcPort}. Connecting to local ${targetLocalHost}:${targetLocalPort}...`);

        let localSocket = null; // Declare before attachment to avoid temporal dead zone (TDZ) ReferenceError (Issue 5)
        const remoteStream = accept();
        // Prevent socket leak on remote stream errors (Issue 8.2)
        remoteStream.on('error', (err) => {
          onLog('error', `[SSH Tunnel Remote Stream Error] ${err.message}`);
          if (localSocket) {
            try { localSocket.destroy(); } catch (e) {}
          }
        });

        localSocket = net.connect(targetLocalPort, targetLocalHost, () => {
          remoteStream.pipe(localSocket);
          localSocket.pipe(remoteStream);
        });

        tunnelObj.activeSockets.add(localSocket);
        localSocket.statsCleanedUp = false;

        localSocket.on('data', (chunk) => { tunnelObj.bytesWritten += chunk.length; });
        remoteStream.on('data', (chunk) => { tunnelObj.bytesRead += chunk.length; });

        const cleanup = () => {
          if (!localSocket.statsCleanedUp) {
            localSocket.statsCleanedUp = true;
            tunnelObj.activeConnections = Math.max(0, tunnelObj.activeConnections - 1);
            tunnelObj.activeSockets.delete(localSocket);
          }
        };

        localSocket.on('close', cleanup);
        remoteStream.on('close', cleanup);
        localSocket.on('error', (err) => {
          onLog('error', `[SSH Tunnel Local Connect Error] ${err.message}`);
          cleanup();
        });
      });

      resolve({
        id: tunnelObj.id,
        status: 'active',
        remoteAddress: `${bindAddr}:${bindPort}`,
        targetAddress: `${targetLocalHost}:${targetLocalPort}`
      });
    });
  }

  /**
   * Dynamic SOCKS5 Proxying: Create a local SOCKS5 server forwarding requests via sshClient
   */
  _startDynamicSocksProxy(tunnelObj, onLog, resolve, reject) {
    const { rule, sshClient } = tunnelObj;
    const localHost = rule.localHost || '127.0.0.1';
    const localPort = parseInt(rule.localPort, 10);

    const socksServer = net.createServer((socket) => {
      tunnelObj.activeConnections++;
      tunnelObj.activeSockets.add(socket);
      socket.statsCleanedUp = false;
      
      // SOCKS5 Handshake & Proxy Tunnel Implementation
      socket.once('data', (data) => {
        if (data[0] !== 0x05) {
          socket.destroy();
          if (!socket.statsCleanedUp) {
            socket.statsCleanedUp = true;
            tunnelObj.activeConnections = Math.max(0, tunnelObj.activeConnections - 1);
            tunnelObj.activeSockets.delete(socket);
          }
          return;
        }

        // Method Selection (No Auth 0x00)
        socket.write(Buffer.from([0x05, 0x00]));

        socket.once('data', (request) => {
          if (request[0] !== 0x05 || request[1] !== 0x01) { // 0x01 = CONNECT
            socket.write(Buffer.from([0x05, 0x07, 0x00, 0x01, 0,0,0,0, 0,0])); // Command not supported
            socket.destroy();
            if (!socket.statsCleanedUp) {
              socket.statsCleanedUp = true;
              tunnelObj.activeConnections = Math.max(0, tunnelObj.activeConnections - 1);
              tunnelObj.activeSockets.delete(socket);
            }
            return;
          }

          let destHost = '';
          let destPort = 0;
          let offset = 4;

          const addrType = request[3];
          if (addrType === 0x01) { // IPv4
            destHost = `${request[4]}.${request[5]}.${request[6]}.${request[7]}`;
            offset = 8;
          } else if (addrType === 0x03) { // Domain Name
            const len = request[4];
            destHost = request.toString('utf8', 5, 5 + len);
            offset = 5 + len;
          } else if (addrType === 0x04) { // IPv6
            socket.write(Buffer.from([0x05, 0x08, 0x00, 0x01, 0,0,0,0, 0,0]));
            socket.destroy();
            if (!socket.statsCleanedUp) {
              socket.statsCleanedUp = true;
              tunnelObj.activeConnections = Math.max(0, tunnelObj.activeConnections - 1);
              tunnelObj.activeSockets.delete(socket);
            }
            return;
          }

          destPort = request.readUInt16BE(offset);

          sshClient.forwardOut(
            socket.remoteAddress || '127.0.0.1',
            socket.remotePort || 0,
            destHost,
            destPort,
            (err, stream) => {
              if (err) {
                onLog('error', `[SOCKS5 Error] Failed to forward to ${destHost}:${destPort}: ${err.message}`);
                socket.write(Buffer.from([0x05, 0x04, 0x00, 0x01, 0,0,0,0, 0,0])); // Host unreachable
                socket.destroy();
                if (!socket.statsCleanedUp) {
                  socket.statsCleanedUp = true;
                  tunnelObj.activeConnections = Math.max(0, tunnelObj.activeConnections - 1);
                  tunnelObj.activeSockets.delete(socket);
                }
                return;
              }

              // Success response: 0x05 (ver), 0x00 (granted), 0x00 (rsv), 0x01 (ipv4)
              socket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 127,0,0,1, 0,0]));

              socket.on('data', (chunk) => { tunnelObj.bytesRead += chunk.length; });
              stream.on('data', (chunk) => { tunnelObj.bytesWritten += chunk.length; });

              socket.pipe(stream);
              stream.pipe(socket);

              const cleanup = () => {
                if (!socket.statsCleanedUp) {
                  socket.statsCleanedUp = true;
                  tunnelObj.activeConnections = Math.max(0, tunnelObj.activeConnections - 1);
                  tunnelObj.activeSockets.delete(socket);
                }
              };

              socket.on('close', cleanup);
              stream.on('close', cleanup);
              socket.on('error', cleanup);
              stream.on('error', cleanup);
            }
          );
        });
      });
    });

    socksServer.on('error', (err) => {
      onLog('error', `[SSH Tunnel SOCKS5 Server Error] ${err.message}`);
      tunnelObj.status = 'error';
      tunnelObj.error = err.message;
      sshClient.end();
      reject(err);
    });

    socksServer.listen(localPort, localHost, () => {
      tunnelObj.status = 'active';
      tunnelObj.localServer = socksServer;
      onLog('info', `[SSH Tunnel Active] Dynamic SOCKS5 Proxy live on ${localHost}:${localPort} ➔ SSH Host ${rule.profileConfig.host}`);
      resolve({
        id: tunnelObj.id,
        status: 'active',
        localAddress: `${localHost}:${localPort}`,
        type: 'socks5'
      });
    });
  }

  /**
   * Stop an active tunnel
   */
  async stopTunnel(tunnelId, onLog = () => {}) {
    const tunnelObj = this.tunnels.get(tunnelId);
    if (!tunnelObj) return false;

    onLog('info', `[SSH Tunnel] Stopping tunnel rule '${tunnelObj.rule.name}'...`);

    if (tunnelObj.localServer) {
      try {
        tunnelObj.localServer.close();
      } catch (e) {}
      tunnelObj.localServer = null;
    }

    // Gracefully drain/destroy active client sockets (Issue 8.1)
    if (tunnelObj.activeSockets && tunnelObj.activeSockets.size > 0) {
      for (const socket of tunnelObj.activeSockets) {
        try {
          socket.end();
          setTimeout(() => {
            try { socket.destroy(); } catch (e) {}
          }, 1000);
        } catch (e) {}
      }
      tunnelObj.activeSockets.clear();
    }

    if (tunnelObj.sshClient) {
      try {
        tunnelObj.sshClient.end();
      } catch (e) {}
      tunnelObj.sshClient = null;
    }

    tunnelObj.status = 'stopped';
    tunnelObj.activeConnections = 0;
    return true;
  }

  /**
   * Stop and delete an SSH tunnel rule
   */
  async deleteTunnel(tunnelId, onLog = () => {}) {
    await this.stopTunnel(tunnelId, onLog);
    this.tunnels.delete(tunnelId);
    return true;
  }

  /**
   * List all tunnel rules and current statistics
   */
  listTunnels() {
    const list = [];
    this.tunnels.forEach((t) => {
      list.push({
        id: t.id,
        rule: t.rule,
        status: t.status,
        activeConnections: t.activeConnections,
        bytesRead: t.bytesRead,
        bytesWritten: t.bytesWritten,
        startTime: t.startTime,
        error: t.error
      });
    });
    return list;
  }

  /**
   * Stop all active tunnels cleanly (used on app shutdown)
   */
  async stopAll() {
    const promises = [];
    this.tunnels.forEach((t, id) => {
      promises.push(this.stopTunnel(id));
    });
    await Promise.all(promises);
  }
}

module.exports = new TunnelService();
