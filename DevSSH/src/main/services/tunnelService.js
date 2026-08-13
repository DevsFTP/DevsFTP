/**
 * DevSSH — Standalone SSH Terminal
 * Copyright (C) 2026 DevsFTP.com
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, version 3 of the License.
 *
 * SSH Tunneling & Port Forwarding Service
 */

const net = require('net');
const { Client } = require('ssh2');
const fs = require('fs');

class TunnelService {
  constructor() {
    this.tunnels = new Map();
  }

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
      activeSockets: new Set()
    };

    this.tunnels.set(tunnelId, tunnelObj);

    return new Promise((resolve, reject) => {
      onLog('info', `Establishing SSH connection for tunnel '${rule.name}'...`);

      const sshClient = new Client();
      tunnelObj.sshClient = sshClient;

      sshClient.on('ready', () => {
        onLog('info', `SSH connection established for '${rule.name}'`);
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
        onLog('error', `SSH tunnel error for '${rule.name}': ${err.message}`);
        tunnelObj.status = 'error';
        tunnelObj.error = err.message;
        this.stopTunnel(tunnelId);
        reject(err);
      });

      sshClient.on('close', () => {
        if (tunnelObj.status === 'active' || tunnelObj.status === 'connecting') {
          onLog('warning', `Tunnel '${rule.name}' connection closed.`);
          tunnelObj.status = 'stopped';
        }
      });

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

  _startLocalForwarding(tunnelObj, onLog, resolve, reject) {
    const { rule, sshClient } = tunnelObj;
    const localHost = rule.localHost || '127.0.0.1';
    const localPort = parseInt(rule.localPort, 10);
    const remoteHost = rule.remoteHost;
    const remotePort = parseInt(rule.remotePort, 10);

    const localServer = net.createServer((socket) => {
      tunnelObj.activeSockets.add(socket);
      tunnelObj.activeConnections++;
      onLog('info', `[Tunnel ${rule.name}] Local connection from ${socket.remoteAddress}:${socket.remotePort}`);

      sshClient.forwardOut(
        localHost,
        localPort,
        remoteHost,
        remotePort,
        (err, stream) => {
          if (err) {
            onLog('error', `[Tunnel ${rule.name}] Port forwarding failed: ${err.message}`);
            socket.destroy();
            tunnelObj.activeSockets.delete(socket);
            return;
          }

          socket.pipe(stream).pipe(socket);

          socket.on('data', (data) => { tunnelObj.bytesRead += data.length; });
          stream.on('data', (data) => { tunnelObj.bytesWritten += data.length; });

          const cleanup = () => {
            socket.destroy();
            stream.end();
            tunnelObj.activeSockets.delete(socket);
            tunnelObj.activeConnections = Math.max(0, tunnelObj.activeConnections - 1);
          };

          socket.on('close', cleanup);
          socket.on('error', cleanup);
          stream.on('close', cleanup);
          stream.on('error', cleanup);
        }
      );
    });

    localServer.on('error', (err) => {
      onLog('error', `[Tunnel ${rule.name}] Local server error: ${err.message}`);
      tunnelObj.status = 'error';
      tunnelObj.error = err.message;
      this.stopTunnel(tunnelObj.id);
      reject(err);
    });

    localServer.listen(localPort, localHost, () => {
      tunnelObj.status = 'active';
      tunnelObj.localServer = localServer;
      onLog('info', `[Tunnel ${rule.name}] Local forwarding listening on ${localHost}:${localPort} -> ${remoteHost}:${remotePort}`);
      resolve(tunnelObj);
    });
  }

  _startRemoteForwarding(tunnelObj, onLog, resolve, reject) {
    const { rule, sshClient } = tunnelObj;
    const remotePort = parseInt(rule.remotePort, 10);
    const localHost = rule.localHost || '127.0.0.1';
    const localPort = parseInt(rule.localPort, 10);

    sshClient.inboundForward(remotePort, (err) => {
      if (err) {
        onLog('error', `[Tunnel ${rule.name}] Inbound forward error: ${err.message}`);
        tunnelObj.status = 'error';
        tunnelObj.error = err.message;
        reject(err);
        return;
      }

      tunnelObj.status = 'active';
      onLog('info', `[Tunnel ${rule.name}] Remote forwarding active on server port ${remotePort} -> local ${localHost}:${localPort}`);
      resolve(tunnelObj);
    });

    sshClient.on('tcp connection', (info, accept, rejectConn) => {
      if (info.destPort !== remotePort) {
        rejectConn();
        return;
      }

      onLog('info', `[Tunnel ${rule.name}] Inbound TCP connection from remote port ${remotePort}`);
      const socket = net.createConnection({ host: localHost, port: localPort }, () => {
        const stream = accept();
        tunnelObj.activeSockets.add(socket);
        tunnelObj.activeConnections++;

        socket.pipe(stream).pipe(socket);

        socket.on('data', (data) => { tunnelObj.bytesWritten += data.length; });
        stream.on('data', (data) => { tunnelObj.bytesRead += data.length; });

        const cleanup = () => {
          socket.destroy();
          stream.end();
          tunnelObj.activeSockets.delete(socket);
          tunnelObj.activeConnections = Math.max(0, tunnelObj.activeConnections - 1);
        };

        socket.on('close', cleanup);
        socket.on('error', cleanup);
        stream.on('close', cleanup);
        stream.on('error', cleanup);
      });

      socket.on('error', (err) => {
        onLog('error', `[Tunnel ${rule.name}] Failed local connection: ${err.message}`);
        rejectConn();
      });
    });
  }

  _startDynamicSocksProxy(tunnelObj, onLog, resolve, reject) {
    const { rule, sshClient } = tunnelObj;
    const localHost = rule.localHost || '127.0.0.1';
    const localPort = parseInt(rule.localPort, 10);

    const localServer = net.createServer((socket) => {
      tunnelObj.activeSockets.add(socket);
      tunnelObj.activeConnections++;

      // Simple SOCKS5 handshake handler
      socket.once('data', (data) => {
        if (data[0] !== 0x05) {
          // Only support SOCKS5
          socket.destroy();
          tunnelObj.activeSockets.delete(socket);
          return;
        }

        const methodsCount = data[1];
        // Send choice (No Authentication required)
        socket.write(Buffer.from([0x05, 0x00]));

        socket.once('data', (request) => {
          if (request[1] !== 0x01) {
            // Only support CONNECT command
            socket.write(Buffer.from([0x05, 0x07, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]));
            socket.destroy();
            tunnelObj.activeSockets.delete(socket);
            return;
          }

          let address = '';
          let offset = 4;
          const addressType = request[3];

          if (addressType === 0x01) {
            // IPv4
            address = `${request[4]}.${request[5]}.${request[6]}.${request[7]}`;
            offset += 4;
          } else if (addressType === 0x03) {
            // Domain name
            const len = request[4];
            address = request.toString('utf8', 5, 5 + len);
            offset += 1 + len;
          } else if (addressType === 0x04) {
            // IPv6 (Unsupported for simplicity)
            socket.write(Buffer.from([0x05, 0x08, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]));
            socket.destroy();
            tunnelObj.activeSockets.delete(socket);
            return;
          }

          const port = request.readUInt16BE(offset);

          sshClient.forwardOut(
            localHost,
            localPort,
            address,
            port,
            (err, stream) => {
              if (err) {
                socket.write(Buffer.from([0x05, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]));
                socket.destroy();
                tunnelObj.activeSockets.delete(socket);
                return;
              }

              // Success response
              socket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]));
              socket.pipe(stream).pipe(socket);

              socket.on('data', (d) => { tunnelObj.bytesRead += d.length; });
              stream.on('data', (d) => { tunnelObj.bytesWritten += d.length; });

              const cleanup = () => {
                socket.destroy();
                stream.end();
                tunnelObj.activeSockets.delete(socket);
                tunnelObj.activeConnections = Math.max(0, tunnelObj.activeConnections - 1);
              };

              socket.on('close', cleanup);
              socket.on('error', cleanup);
              stream.on('close', cleanup);
              stream.on('error', cleanup);
            }
          );
        });
      });
    });

    localServer.on('error', (err) => {
      onLog('error', `[Tunnel ${rule.name}] Local SOCKS server error: ${err.message}`);
      tunnelObj.status = 'error';
      tunnelObj.error = err.message;
      this.stopTunnel(tunnelObj.id);
      reject(err);
    });

    localServer.listen(localPort, localHost, () => {
      tunnelObj.status = 'active';
      tunnelObj.localServer = localServer;
      onLog('info', `[Tunnel ${rule.name}] Dynamic SOCKS5 listening on ${localHost}:${localPort}`);
      resolve(tunnelObj);
    });
  }

  async stopTunnel(tunnelId, onLog = () => {}) {
    const tunnelObj = this.tunnels.get(tunnelId);
    if (!tunnelObj) return;

    onLog('info', `Stopping tunnel '${tunnelObj.rule.name || tunnelId}'...`);
    tunnelObj.status = 'stopped';

    if (tunnelObj.localServer) {
      try {
        tunnelObj.localServer.close();
      } catch (e) {}
    }

    for (const socket of tunnelObj.activeSockets) {
      try {
        socket.destroy();
      } catch (e) {}
    }
    tunnelObj.activeSockets.clear();

    if (tunnelObj.sshClient) {
      try {
        tunnelObj.sshClient.end();
      } catch (e) {}
    }

    tunnelObj.activeConnections = 0;
    onLog('info', `Tunnel '${tunnelObj.rule.name || tunnelId}' stopped.`);
  }

  listTunnels() {
    return Array.from(this.tunnels.values()).map(t => ({
      id: t.id,
      rule: { ...t.rule, profileConfig: undefined }, // Omit credential detail
      status: t.status,
      activeConnections: t.activeConnections,
      bytesRead: t.bytesRead,
      bytesWritten: t.bytesWritten,
      startTime: t.startTime,
      error: t.error
    }));
  }
}

module.exports = TunnelService;
