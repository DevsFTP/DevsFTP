/**
 * Scheduled Job Runner Daemon Service
 * Executes automated sync and backup jobs in main process according to schedule or app startup.
 */

const fs = require('fs');
const path = require('path');
const { Notification } = require('electron');
const SFTPService = require('./sftpService');
const FTPService = require('./ftpService');

class JobRunnerService {
  constructor(ipcWindow, jobStore, profileStore, logFn) {
    this.ipcWindow = ipcWindow;
    this.jobStore = jobStore;
    this.profileStore = profileStore;
    this.logFn = logFn || console.log;

    this.timer = null;
    this.runningJobs = new Set();
  }

  start() {
    if (this.timer) clearInterval(this.timer);
    
    // Check schedules every 10 seconds for high precision
    this.timer = setInterval(() => this.checkSchedules(), 10000);

    // Initial check after 3 seconds on startup
    setTimeout(() => {
      this.checkSchedules();
      this.executeStartupJobs();
    }, 3000);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  notifyWindow() {
    if (this.ipcWindow && !this.ipcWindow.isDestroyed()) {
      this.ipcWindow.webContents.send('jobs:updated', this.jobStore.getAll());
    }
  }

  log(type, msg) {
    if (this.logFn) this.logFn(type, msg);
  }

  calculateNextRun(job) {
    if (!job.enabled) return null;
    const now = new Date();

    if (job.frequency === 'startup') {
      return 'On App Startup';
    }

    if (job.frequency === 'interval') {
      const minutes = parseInt(job.intervalMinutes || 60, 10);
      const baseTime = job.lastRun ? new Date(job.lastRun) : (job.createdAt ? new Date(job.createdAt) : now);
      let next = new Date(baseTime.getTime() + minutes * 60000);
      if (next <= now && !job.lastRun) {
        return new Date(now.getTime() - 1000).toISOString();
      }
      return next.toISOString();
    }

    if (job.frequency === 'daily') {
      let hours = 3;
      let mins = 0;
      if (job.scheduleTime && String(job.scheduleTime).includes(':')) {
        const parts = String(job.scheduleTime).split(':').map(Number);
        hours = parts[0] || 0;
        mins = parts[1] || 0;
      } else {
        hours = parseInt(job.scheduleHour || 3, 10);
        mins = parseInt(job.scheduleMinute || 0, 10);
      }
      const next = new Date();
      next.setHours(hours, mins, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      return next.toISOString();
    }

    if (job.frequency === 'once') {
      return job.targetTimestamp ? new Date(job.targetTimestamp).toISOString() : null;
    }

    return null;
  }

  async checkSchedules() {
    const jobs = this.jobStore.getAll();
    const now = new Date();

    for (const job of jobs) {
      if (!job.enabled || this.runningJobs.has(job.id)) continue;
      if (job.frequency === 'startup') continue;

      const nextRunStr = this.calculateNextRun(job);
      if (!nextRunStr || nextRunStr === 'On App Startup') continue;

      const nextRunDate = new Date(nextRunStr);
      if (nextRunDate <= now) {
        this.log('info', `⏰ Scheduled Job trigger fired: "${job.name}"`);
        this.executeJob(job.id);
      }
    }
  }

  async executeStartupJobs() {
    const jobs = this.jobStore.getAll().filter(j => j.enabled && j.frequency === 'startup');
    if (jobs.length === 0) return;

    this.log('info', `⏰ Executing ${jobs.length} startup scheduled job(s)...`);
    for (const job of jobs) {
      if (!this.runningJobs.has(job.id)) {
        this.executeJob(job.id);
      }
    }
  }

  async executeJob(jobId) {
    const job = this.jobStore.getById(jobId);
    if (!job || this.runningJobs.has(jobId)) return;

    this.runningJobs.add(jobId);
    job.lastStatus = 'Running';
    this.jobStore.upsert(job);
    this.notifyWindow();

    this.log('info', `⚡ Executing Scheduled Job [${job.name}] (${job.jobType.toUpperCase()})...`);

    const profiles = this.profileStore.getAll();
    const profile = profiles.find(p => p.id === job.profileId);

    if (!profile) {
      job.lastStatus = 'Failed';
      job.lastRun = new Date().toISOString();
      this.jobStore.upsert(job);
      this.runningJobs.delete(jobId);
      this.notifyWindow();
      this.log('error', `❌ Scheduled Job [${job.name}] failed: Profile not found.`);
      return;
    }

    const Driver = (profile.protocol === 'ftp' || profile.protocol === 'ftps') ? FTPService : SFTPService;
    const driver = new Driver();

    try {
      this.log('info', `[Job Engine] Connecting to target server ${profile.name} (${profile.host})...`);
      await driver.connect(profile, (lvl, msg) => this.log(lvl, `[Job: ${job.name}] ${msg}`));

      if (job.jobType === 'download') {
        let isDir = false;
        if (driver.stat) {
          try {
            const st = await driver.stat(job.sourcePath);
            isDir = st ? Boolean(st.isDir || st.isDirectory) : false;
          } catch (e) {}
        }
        if (isDir && driver.downloadDir) {
          await driver.downloadDir(job.sourcePath, job.destPath, null);
        } else {
          await driver.downloadFile(job.sourcePath, job.destPath, null);
        }
      } else {
        // Upload or Sync
        let isDir = false;
        try {
          if (fs.existsSync(job.sourcePath)) {
            isDir = fs.statSync(job.sourcePath).isDirectory();
          }
        } catch (e) {}

        if (isDir && driver.uploadDir) {
          await driver.uploadDir(job.sourcePath, job.destPath, null);
        } else {
          await driver.uploadFile(job.sourcePath, job.destPath, null);
        }
      }

      job.lastStatus = 'Success';
      job.lastError = null;
      job.lastRun = new Date().toISOString();
      job.nextRun = this.calculateNextRun(job);
      this.jobStore.upsert(job);
      this.log('info', `✅ Scheduled Job [${job.name}] completed successfully.`);

      try {
        if (Notification.isSupported()) {
          const notif = new Notification({
            title: 'Scheduled Job Complete',
            body: `Job "${job.name}" executed successfully.`,
            silent: false
          });
          notif.show();
        }
      } catch (e) {}
    } catch (err) {
      const errMsg = err && err.message ? err.message : String(err);
      job.lastStatus = 'Failed';
      job.lastError = errMsg;
      job.lastRun = new Date().toISOString();
      this.jobStore.upsert(job);
      this.log('error', `❌ Scheduled Job [${job.name}] failed: ${errMsg}`);

      try {
        if (Notification.isSupported()) {
          const notif = new Notification({
            title: 'Scheduled Job Failed',
            body: `Job "${job.name}" failed: ${errMsg}`,
            silent: false
          });
          notif.show();
        }
      } catch (e) {}
    } finally {
      if (driver.disconnect) {
        try { await driver.disconnect(); } catch (e) {}
      }
      this.runningJobs.delete(jobId);
      this.notifyWindow();
    }
  }
}

module.exports = JobRunnerService;
