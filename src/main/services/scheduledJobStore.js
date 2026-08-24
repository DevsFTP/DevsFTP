/**
 * Scheduled Jobs Persistent Store
 * Securely persists automated sync & backup jobs in app user data.
 */

const fs = require('fs');
const path = require('path');

let app = null;
try {
  app = require('electron').app;
} catch (e) {
  app = null;
}

class ScheduledJobStore {
  constructor() {
    const userDataPath = app ? app.getPath('userData') : path.join(process.cwd(), '.devs_userData');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    this.filePath = path.join(userDataPath, 'scheduled_jobs.json');
    this.jobs = this._load();
  }

  _load() {
    if (!fs.existsSync(this.filePath)) {
      return [];
    }
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      console.error('Error loading scheduled jobs:', err);
      return [];
    }
  }

  save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.jobs, null, 2), 'utf8');
    } catch (err) {
      console.error('Error saving scheduled jobs:', err);
    }
  }

  getAll() {
    return this.jobs;
  }

  getById(id) {
    return this.jobs.find(j => j.id === id);
  }

  upsert(job) {
    if (!job.id) {
      job.id = 'job_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    }

    const idx = this.jobs.findIndex(j => j.id === job.id);
    const updated = {
      name: 'Scheduled Job',
      profileId: 'default',
      jobType: 'upload', // 'upload' | 'download' | 'sync'
      sourcePath: '',
      destPath: '',
      conflictPolicy: 'newer', // 'overwrite' | 'newer' | 'skip'
      frequency: 'startup', // 'startup' | 'interval' | 'daily'
      intervalMinutes: 60,
      scheduleTime: '03:00',
      createdAt: new Date().toISOString(),
      enabled: true,
      lastRun: null,
      nextRun: null,
      lastStatus: 'Pending', // 'Pending' | 'Running' | 'Success' | 'Failed'
      notes: '',
      ...job
    };

    if (idx >= 0) {
      this.jobs[idx] = { ...this.jobs[idx], ...updated };
    } else {
      this.jobs.push(updated);
    }
    this.save();
    return updated;
  }

  delete(id) {
    this.jobs = this.jobs.filter(j => j.id !== id);
    this.save();
    return true;
  }
}

module.exports = ScheduledJobStore;
