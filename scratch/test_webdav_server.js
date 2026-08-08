const { v2: webdav } = require('webdav-server');
const path = require('path');
const fs = require('fs');

const webdavDir = 'C:/xampp/webdav';
if (!fs.existsSync(webdavDir)) {
  fs.mkdirSync(webdavDir, { recursive: true });
}

const testFile = path.join(webdavDir, 'welcome_webdav.txt');
if (!fs.existsSync(testFile)) {
  fs.writeFileSync(testFile, 'Hello from DevsFTP WebDAV Server on port 8085!\n');
}

const userManager = new webdav.SimpleUserManager();
const user = userManager.addUser('test', 'test', false);

const server = new webdav.WebDAVServer({
  port: 8085,
  httpAuthentication: new webdav.HTTPBasicAuthentication(userManager, 'DevsFTP Test WebDAV')
});

server.setFileSystem('/', new webdav.PhysicalFileSystem(webdavDir), (success) => {
  server.start(() => {
    console.log('✓ Test WebDAV Server running at http://localhost:8085/ (User: test, Pass: test)');
  });
});
