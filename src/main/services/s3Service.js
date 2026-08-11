/**
 * DevsFTP — Remote Development Workspace
 * Copyright (C) 2026 DevsFTP.com
 *
 * S3 Cloud Storage Driver Service using AWS SDK v3.
 * Supports AWS S3 and S3-compatible providers (MinIO, DigitalOcean Spaces,
 * Wasabi, Cloudflare R2, Backblaze B2, etc.).
 */

const { 
  S3Client, 
  ListObjectsV2Command, 
  GetObjectCommand, 
  PutObjectCommand, 
  DeleteObjectCommand, 
  DeleteObjectsCommand, 
  CopyObjectCommand 
} = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

class S3Service {
  constructor() {
    this.client = null;
    this.connected = false;
    this.currentConfig = null;
    this.bucket = null;
  }

  /**
   * Connect to an S3 bucket.
   * username: Access Key ID
   * password: Secret Access Key
   */
  async connect(config, onLog) {
    this.currentConfig = config;
    this.bucket = config.s3Bucket;

    if (!this.bucket) {
      throw new Error('S3 Bucket Name is required.');
    }
    if (!config.username) {
      throw new Error('S3 Access Key ID (Username) is required.');
    }
    if (!config.password) {
      throw new Error('S3 Secret Access Key (Password) is required.');
    }

    const region = config.s3Region || 'us-east-1';
    if (onLog) onLog('info', `Connecting to S3 bucket '${this.bucket}' in region '${region}'...`);

    const clientConfig = {
      credentials: {
        accessKeyId: config.username,
        secretAccessKey: config.password,
      },
      region,
    };

    if (config.s3Endpoint) {
      clientConfig.endpoint = config.s3Endpoint;
      // Force path style access for custom/compatible endpoints (MinIO, Ceph, DO Spaces)
      clientConfig.forcePathStyle = true;
      if (onLog) onLog('info', `Using custom S3 Endpoint: ${config.s3Endpoint}`);
    }

    try {
      this.client = new S3Client(clientConfig);

      // Verify connection by listing maximum 1 object from the bucket
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        MaxKeys: 1,
      });

      await this.client.send(command);
      this.connected = true;
      if (onLog) onLog('info', `S3 Session established successfully to bucket: ${this.bucket}`);
      return true;
    } catch (err) {
      this.connected = false;
      this.client = null;
      if (onLog) onLog('error', `S3 Connection failed: ${err.message}`);
      throw err;
    }
  }

  // Strip leading slash for S3 keys, but keep trailing slash for folders if present
  _pathToKey(remotePath) {
    if (!remotePath || remotePath === '/') return '';
    let key = remotePath;
    if (key.startsWith('/')) key = key.slice(1);
    return key;
  }

  _keyToPath(key) {
    if (!key) return '/';
    return '/' + key;
  }

  async list(remotePath) {
    if (!this.connected || !this.client) {
      throw new Error('S3 client is not connected.');
    }

    let prefix = this._pathToKey(remotePath);
    if (prefix && !prefix.endsWith('/')) {
      prefix += '/';
    }

    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        Delimiter: '/',
      });

      const response = await this.client.send(command);
      const items = [];

      // 1. Map CommonPrefixes to virtual folders
      if (response.CommonPrefixes) {
        response.CommonPrefixes.forEach(cp => {
          const key = cp.Prefix;
          // Extract directory name (e.g., "assets/js/" -> "js")
          const cleanKey = key.endsWith('/') ? key.slice(0, -1) : key;
          const parts = cleanKey.split('/');
          const name = parts[parts.length - 1];

          items.push({
            name,
            path: this._keyToPath(key),
            isDir: true,
            size: 0,
            modifyTime: new Date().toISOString(),
          });
        });
      }

      // 2. Map Contents to files
      if (response.Contents) {
        response.Contents.forEach(obj => {
          const key = obj.Key;
          // Filter out the directory placeholder itself
          if (key === prefix) return;

          const parts = key.split('/');
          const name = parts[parts.length - 1];

          // Skip nested objects that shouldn't appear at this depth
          if (!name && key.endsWith('/')) return; 

          items.push({
            name,
            path: this._keyToPath(key),
            isDir: false,
            size: obj.Size || 0,
            modifyTime: obj.LastModified ? obj.LastModified.toISOString() : new Date().toISOString(),
          });
        });
      }

      return items;
    } catch (err) {
      throw new Error(`S3 list failed: ${err.message}`);
    }
  }

  async downloadFile(remotePath, localPath, onProgress) {
    if (!this.connected || !this.client) {
      throw new Error('S3 client is not connected.');
    }

    const key = this._pathToKey(remotePath);

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);
      if (!response.Body) {
        throw new Error('Empty body returned from S3 GetObject.');
      }

      // Ensure directory exists
      fs.mkdirSync(path.dirname(localPath), { recursive: true });

      const writeStream = fs.createWriteStream(localPath);
      
      let downloadedBytes = 0;
      const totalBytes = response.ContentLength || 0;

      await new Promise((resolve, reject) => {
        response.Body.on('data', chunk => {
          downloadedBytes += chunk.length;
          if (onProgress && totalBytes > 0) {
            onProgress(downloadedBytes, totalBytes);
          }
        });

        response.Body.pipe(writeStream);
        response.Body.on('error', reject);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      return true;
    } catch (err) {
      throw new Error(`S3 download failed: ${err.message}`);
    }
  }

  async uploadFile(localPath, remotePath, onProgress) {
    if (!this.connected || !this.client) {
      throw new Error('S3 client is not connected.');
    }

    const key = this._pathToKey(remotePath);
    if (!fs.existsSync(localPath)) {
      throw new Error(`Local file not found: ${localPath}`);
    }

    const fileStats = fs.statSync(localPath);
    const totalBytes = fileStats.size;

    try {
      const fileStream = fs.createReadStream(localPath);
      let uploadedBytes = 0;

      if (onProgress) {
        fileStream.on('data', chunk => {
          uploadedBytes += chunk.length;
          onProgress(uploadedBytes, totalBytes);
        });
      }

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: fileStream,
        ContentLength: totalBytes,
      });

      await this.client.send(command);
      return true;
    } catch (err) {
      throw new Error(`S3 upload failed: ${err.message}`);
    }
  }

  async delete(remotePath, isDir) {
    if (!this.connected || !this.client) {
      throw new Error('S3 client is not connected.');
    }

    const key = this._pathToKey(remotePath);

    try {
      if (!isDir) {
        const command = new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        });
        await this.client.send(command);
      } else {
        // Folder: recursively delete all prefix keys
        let prefix = key;
        if (prefix && !prefix.endsWith('/')) {
          prefix += '/';
        }

        let continuationToken = undefined;
        do {
          const listCommand = new ListObjectsV2Command({
            Bucket: this.bucket,
            Prefix: prefix,
            ContinuationToken: continuationToken,
          });

          const listResponse = await this.client.send(listCommand);
          if (listResponse.Contents && listResponse.Contents.length > 0) {
            const objectsToDelete = listResponse.Contents.map(obj => ({ Key: obj.Key }));
            const deleteCommand = new DeleteObjectsCommand({
              Bucket: this.bucket,
              Delete: { Objects: objectsToDelete },
            });
            await this.client.send(deleteCommand);
          }

          continuationToken = listResponse.NextContinuationToken;
        } while (continuationToken);

        // Try deleting prefix placeholder key
        try {
          const delDirCommand = new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: prefix,
          });
          await this.client.send(delDirCommand);
        } catch (e) {}
      }
      return true;
    } catch (err) {
      throw new Error(`S3 delete failed: ${err.message}`);
    }
  }

  async rename(oldPath, newPath) {
    if (!this.connected || !this.client) {
      throw new Error('S3 client is not connected.');
    }

    const oldKey = this._pathToKey(oldPath);
    const newKey = this._pathToKey(newPath);

    try {
      // Copy object
      const copyCommand = new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${oldKey}`,
        Key: newKey,
      });
      await this.client.send(copyCommand);

      // Delete original
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: oldKey,
      });
      await this.client.send(deleteCommand);
      return true;
    } catch (err) {
      throw new Error(`S3 rename/move failed: ${err.message}`);
    }
  }

  async mkdir(remotePath) {
    if (!this.connected || !this.client) {
      throw new Error('S3 client is not connected.');
    }

    let key = this._pathToKey(remotePath);
    if (key && !key.endsWith('/')) {
      key += '/';
    }

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: '',
      });
      await this.client.send(command);
      return true;
    } catch (err) {
      throw new Error(`S3 mkdir failed: ${err.message}`);
    }
  }

  disconnect() {
    this.client = null;
    this.connected = false;
  }
}

module.exports = S3Service;
