/**
 * DevsFTP — Remote Development Workspace
 * Copyright (C) 2026 DevsFTP.com
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 * Scheduled Jobs Renderer Component for DevsFTP
 * Handles rendering the Scheduled Jobs drawer panel table, creating and editing jobs via #schedule-job-modal,
 * toggling job active status, running jobs on demand, and listening for IPC updates.
 */

window.ScheduledJobs = {
  jobs: [],
  tbody: null,
  badge: null,
  profiles: [],

  getApi() {
    return window.devsFTP || window.pulseFTP;
  },

  async init() {
    this.tbody = document.getElementById('jobs-tbody');
    this.badge = document.getElementById('jobs-badge');

    // Drawer toolbar bindings
    const btnCreateDrawer = document.getElementById('btn-create-job-drawer');
    const btnRunAll = document.getElementById('btn-jobs-run-all');

    if (btnCreateDrawer) btnCreateDrawer.addEventListener('click', () => this.openJobModal());
    if (btnRunAll) btnRunAll.addEventListener('click', () => this.runAllActive());

    // Modal bindings
    const btnClose = document.getElementById('btn-job-modal-close');
    const btnCancel = document.getElementById('btn-job-modal-cancel');
    const btnSubmit = document.getElementById('btn-job-modal-submit');

    if (btnClose) btnClose.addEventListener('click', () => this.closeJobModal());
    if (btnCancel) btnCancel.addEventListener('click', () => this.closeJobModal());
    if (btnSubmit) btnSubmit.addEventListener('click', () => this.submitJobModal());

    const btnDelClose = document.getElementById('btn-delete-job-close');
    const btnDelCancel = document.getElementById('btn-delete-job-cancel');
    const btnDelConfirm = document.getElementById('btn-delete-job-confirm');

    if (btnDelClose) btnDelClose.onclick = () => this.closeDeleteModal();
    if (btnDelCancel) btnDelCancel.onclick = () => this.closeDeleteModal();
    if (btnDelConfirm) btnDelConfirm.onclick = () => this.confirmDeleteJob();

    const api = this.getApi();
    if (api && api.onJobsUpdated) {
      api.onJobsUpdated((updatedJobs) => {
        this.jobs = updatedJobs || [];
        this.render();
      });
    }

    await this.refresh();
  },

  async refresh() {
    const api = this.getApi();
    if (api && api.jobs && api.jobs.getAll) {
      try {
        this.jobs = await api.jobs.getAll() || [];
      } catch (e) {
        this.jobs = [];
      }
    }
    if (api && api.profiles && api.profiles.getAll) {
      try {
        this.profiles = await api.profiles.getAll() || [];
      } catch (e) {
        this.profiles = [];
      }
    }
    this.render();
  },

  async openJobModal(job = null) {
    const api = this.getApi();
    if (api && api.profiles && api.profiles.getAll) {
      try {
        this.profiles = await api.profiles.getAll() || [];
      } catch (e) {}
    }

    const modal = document.getElementById('schedule-job-modal');
    const title = document.getElementById('job-modal-title');
    const editId = document.getElementById('job-edit-id');
    const nameInput = document.getElementById('job-name-input');
    const profileSelect = document.getElementById('job-profile-select');
    const typeSelect = document.getElementById('job-type-select');
    const sourceInput = document.getElementById('job-source-path');
    const destInput = document.getElementById('job-dest-path');
    const freqSelect = document.getElementById('job-frequency-select');
    const intervalSelect = document.getElementById('job-interval-select');
    const dailyHourSelect = document.getElementById('job-daily-hour');
    const dailyMinSelect = document.getElementById('job-daily-minute');
    const intervalBox = document.getElementById('job-interval-container');
    const dailyBox = document.getElementById('job-daily-container');

    const btnBrowseSrcOS = document.getElementById('btn-job-browse-src-os');
    const btnPickSrcLocal = document.getElementById('btn-job-pick-src-local');
    const btnPickSrcRemote = document.getElementById('btn-job-pick-src-remote');

    const btnBrowseDstOS = document.getElementById('btn-job-browse-dst-os');
    const btnPickDstLocal = document.getElementById('btn-job-pick-dst-local');
    const btnPickDstRemote = document.getElementById('btn-job-pick-dst-remote');

    if (!modal) return;

    if (btnBrowseSrcOS) {
      btnBrowseSrcOS.onclick = async () => {
        const api = this.getApi();
        if (api && api.selectLocalPath) {
          const selected = await api.selectLocalPath();
          if (selected && sourceInput) sourceInput.value = selected;
        }
      };
    }

    if (btnPickSrcLocal) {
      btnPickSrcLocal.onclick = () => {
        if (window.FileBrowser && window.FileBrowser.localPath && sourceInput) {
          sourceInput.value = window.FileBrowser.localPath;
        }
      };
    }

    if (btnPickSrcRemote) {
      btnPickSrcRemote.onclick = () => {
        if (window.FileBrowser && window.FileBrowser.remotePath && sourceInput) {
          sourceInput.value = window.FileBrowser.remotePath;
        }
      };
    }

    if (btnBrowseDstOS) {
      btnBrowseDstOS.onclick = async () => {
        const api = this.getApi();
        if (api && api.selectLocalPath) {
          const selected = await api.selectLocalPath();
          if (selected && destInput) destInput.value = selected;
        }
      };
    }

    if (btnPickDstLocal) {
      btnPickDstLocal.onclick = () => {
        if (window.FileBrowser && window.FileBrowser.localPath && destInput) {
          destInput.value = window.FileBrowser.localPath;
        }
      };
    }

    if (btnPickDstRemote) {
      btnPickDstRemote.onclick = () => {
        if (window.FileBrowser && window.FileBrowser.remotePath && destInput) {
          destInput.value = window.FileBrowser.remotePath;
        }
      };
    }

    const updateTypeLabels = () => {
      const type = typeSelect ? typeSelect.value : 'upload';
      const srcLabel = document.getElementById('job-src-label');
      const dstLabel = document.getElementById('job-dest-label');

      if (type === 'upload') {
        if (srcLabel) srcLabel.textContent = 'Local Source Path (Folder or File on PC)';
        if (dstLabel) dstLabel.textContent = 'Remote Destination Directory (Path on Server)';
        if (btnBrowseSrcOS) btnBrowseSrcOS.style.display = 'inline-block';
        if (btnPickSrcLocal) btnPickSrcLocal.style.display = 'inline-block';
        if (btnPickSrcRemote) btnPickSrcRemote.style.display = 'none';

        if (btnBrowseDstOS) btnBrowseDstOS.style.display = 'none';
        if (btnPickDstLocal) btnPickDstLocal.style.display = 'none';
        if (btnPickDstRemote) btnPickDstRemote.style.display = 'inline-block';
      } else {
        if (srcLabel) srcLabel.textContent = 'Remote Source Path (File or Directory on Server)';
        if (dstLabel) dstLabel.textContent = 'Local Destination Folder (Directory on PC)';
        if (btnBrowseSrcOS) btnBrowseSrcOS.style.display = 'none';
        if (btnPickSrcLocal) btnPickSrcLocal.style.display = 'none';
        if (btnPickSrcRemote) btnPickSrcRemote.style.display = 'inline-block';

        if (btnBrowseDstOS) btnBrowseDstOS.style.display = 'inline-block';
        if (btnPickDstLocal) btnPickDstLocal.style.display = 'inline-block';
        if (btnPickDstRemote) btnPickDstRemote.style.display = 'none';
      }
    };

    if (typeSelect) typeSelect.onchange = updateTypeLabels;

    const updateFreqVisibility = () => {
      const freq = freqSelect ? freqSelect.value : 'startup';
      if (intervalBox) intervalBox.style.display = freq === 'interval' ? 'block' : 'none';
      if (dailyBox) dailyBox.style.display = freq === 'daily' ? 'flex' : 'none';
    };

    if (freqSelect) freqSelect.onchange = updateFreqVisibility;

    // Populate profiles dropdown
    if (profileSelect) {
      profileSelect.innerHTML = '';
      if (this.profiles.length === 0) {
        profileSelect.innerHTML = '<option value="">No saved profiles found</option>';
      } else {
        this.profiles.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.textContent = `⚡ ${p.name} (${p.host}:${p.port})`;
          profileSelect.appendChild(opt);
        });
      }
    }

    if (job) {
      if (title) title.textContent = '✏️ Edit Scheduled Job';
      if (editId) editId.value = job.id;
      if (nameInput) nameInput.value = job.name || '';
      if (profileSelect) profileSelect.value = job.profileId || '';
      if (typeSelect) typeSelect.value = job.jobType || 'upload';
      if (sourceInput) sourceInput.value = job.sourcePath || '';
      if (destInput) destInput.value = job.destPath || '';
      if (freqSelect) freqSelect.value = job.frequency || 'startup';

      if (intervalSelect) intervalSelect.value = String(job.intervalMinutes || 60);

      let h = 3, m = 0;
      if (job.scheduleTime && String(job.scheduleTime).includes(':')) {
        const parts = String(job.scheduleTime).split(':').map(Number);
        h = parts[0] || 0;
        m = parts[1] || 0;
      } else {
        h = job.scheduleHour || 3;
        m = job.scheduleMinute || 0;
      }
      if (dailyHourSelect) dailyHourSelect.value = String(h);
      if (dailyMinSelect) dailyMinSelect.value = String(m);
    } else {
      if (title) title.textContent = '⏰ Configure New Scheduled Job';
      if (editId) editId.value = '';
      if (nameInput) nameInput.value = 'Automated Site Backup';
      if (sourceInput) sourceInput.value = '';
      if (destInput) destInput.value = '';
      if (freqSelect) freqSelect.value = 'startup';
      if (intervalSelect) intervalSelect.value = '60';
      if (dailyHourSelect) dailyHourSelect.value = '3';
      if (dailyMinSelect) dailyMinSelect.value = '0';
    }

    updateTypeLabels();
    updateFreqVisibility();
    modal.classList.add('active');
    setTimeout(() => { if (nameInput) nameInput.focus(); }, 100);
  },

  closeJobModal() {
    const modal = document.getElementById('schedule-job-modal');
    if (modal) modal.classList.remove('active');
  },

  async submitJobModal() {
    const editId = document.getElementById('job-edit-id')?.value;
    const name = document.getElementById('job-name-input')?.value.trim();
    const profileId = document.getElementById('job-profile-select')?.value;
    const jobType = document.getElementById('job-type-select')?.value;
    const sourcePath = document.getElementById('job-source-path')?.value.trim();
    const destPath = document.getElementById('job-dest-path')?.value.trim();
    const frequency = document.getElementById('job-frequency-select')?.value;

    const intervalMinutes = parseInt(document.getElementById('job-interval-select')?.value || '60', 10);
    const scheduleHour = parseInt(document.getElementById('job-daily-hour')?.value || '3', 10);
    const scheduleMinute = parseInt(document.getElementById('job-daily-minute')?.value || '0', 10);

    const pad = (num) => String(num).padStart(2, '0');
    const scheduleTime = `${pad(scheduleHour)}:${pad(scheduleMinute)}`;

    if (!name || !profileId || !sourcePath || !destPath) {
      alert('Please fill out all required fields (Name, Server Profile, Source, Destination).');
      return;
    }

    if (jobType === 'download' && /^[a-zA-Z]:[\\/]/.test(sourcePath)) {
      alert(`⚠️ Invalid Remote Source Path:\n"${sourcePath}" is a local Windows path.\n\nFor a Download job, the Source Path must be a path on your remote server (e.g. /public or /var/www), and the Destination Path must be a folder on your Windows PC.`);
      return;
    }

    if (jobType === 'upload' && /^[a-zA-Z]:[\\/]/.test(destPath)) {
      alert(`⚠️ Invalid Remote Destination Path:\n"${destPath}" is a local Windows path.\n\nFor an Upload job, the Destination Path must be a path on your remote server (e.g. /public or /var/www), and the Source Path must be a folder or file on your Windows PC.`);
      return;
    }

    const job = {
      id: editId || undefined,
      name,
      profileId,
      jobType,
      sourcePath,
      destPath,
      frequency,
      intervalMinutes: frequency === 'interval' ? intervalMinutes : 60,
      scheduleHour,
      scheduleMinute,
      scheduleTime,
      enabled: true
    };

    const api = this.getApi();
    if (api && api.jobs && api.jobs.upsert) {
      await api.jobs.upsert(job);
      if (window.LogViewer) window.LogViewer.addEntry('info', `⏰ Saved Scheduled Job: "${name}"`);
    }

    this.closeJobModal();
    await this.refresh();
  },

  async runJobNow(id) {
    const api = this.getApi();
    if (api && api.jobs && api.jobs.runNow) {
      await api.jobs.runNow(id);
      if (window.LogViewer) window.LogViewer.addEntry('info', `⚡ Initiated manual run for scheduled job ID: ${id}`);
    }
  },

  async toggleJob(id, currentEnabled) {
    const api = this.getApi();
    if (api && api.jobs && api.jobs.toggle) {
      await api.jobs.toggle(id, !currentEnabled);
      await this.refresh();
    }
  },

  openDeleteModal(id) {
    const job = this.jobs.find(j => j.id === id);
    if (!job) return;

    this.pendingDeleteId = id;
    const modal = document.getElementById('delete-job-modal');
    const nameEl = document.getElementById('del-job-val-name');
    const profEl = document.getElementById('del-job-val-profile');
    const freqEl = document.getElementById('del-job-val-freq');

    const prof = this.profiles.find(p => p.id === job.profileId);
    const profName = prof ? prof.name : (job.profileId || 'Default Profile');

    if (nameEl) nameEl.textContent = job.name || 'Scheduled Job';
    if (profEl) profEl.textContent = profName;
    if (freqEl) freqEl.textContent = this.getFrequencyLabel(job);

    if (modal) modal.classList.add('active');
  },

  closeDeleteModal() {
    this.pendingDeleteId = null;
    const modal = document.getElementById('delete-job-modal');
    if (modal) modal.classList.remove('active');
  },

  async confirmDeleteJob() {
    if (!this.pendingDeleteId) return;
    const id = this.pendingDeleteId;
    const api = this.getApi();
    if (api && api.jobs && api.jobs.delete) {
      await api.jobs.delete(id);
      if (window.LogViewer) window.LogViewer.addEntry('warning', `🗑 Deleted scheduled job ID: ${id}`);
      await this.refresh();
    }
    this.closeDeleteModal();
  },

  deleteJob(id) {
    this.openDeleteModal(id);
  },

  async runAllActive() {
    const activeJobs = this.jobs.filter(j => j.enabled);
    if (activeJobs.length === 0) {
      alert('No active scheduled jobs to run.');
      return;
    }
    for (const job of activeJobs) {
      await this.runJobNow(job.id);
    }
  },

  getStatusBadge(job) {
    const status = (typeof job === 'string' ? job : (job ? job.lastStatus : 'Pending')) || 'Pending';
    const errorMsg = (typeof job === 'object' && job) ? job.lastError : null;

    let bg = 'rgba(100, 116, 139, 0.2)';
    let fg = '#94A3B8';

    if (status === 'Success') {
      bg = 'rgba(16, 185, 129, 0.2)';
      fg = '#34D399';
    } else if (status === 'Running') {
      bg = 'rgba(16, 185, 129, 0.2)';
      fg = '#FBBF24';
    } else if (status === 'Failed') {
      bg = 'rgba(239, 68, 68, 0.2)';
      fg = '#FCA5A5';
    }

    let html = `<span class="tag-badge" style="background-color: ${bg}; color: ${fg}; font-weight: 600;" title="${errorMsg || status}">${status}</span>`;
    if (status === 'Failed' && errorMsg) {
      html += `<div style="font-size: 10px; color: #FCA5A5; margin-top: 3px; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${errorMsg}">⚠️ ${errorMsg}</div>`;
    }
    return html;
  },

  getFrequencyLabel(job) {
    if (job.frequency === 'startup') return '🚀 On Launch';
    if (job.frequency === 'interval') return `⏱️ Every ${job.intervalMinutes || 60}m`;
    if (job.frequency === 'daily') return `📅 Daily @ ${job.scheduleTime || '03:00'}`;
    return job.frequency;
  },

  render() {
    if (!this.tbody) return;

    const activeCount = this.jobs.filter(j => j.enabled).length;
    if (this.badge) this.badge.textContent = activeCount;

    if (this.jobs.length === 0) {
      this.tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: hsl(var(--text-muted)); padding: 16px;">No scheduled jobs configured. Click "+ Create Scheduled Job" to automate transfers.</td></tr>';
      return;
    }

    this.tbody.innerHTML = '';
    this.jobs.forEach(job => {
      const tr = document.createElement('tr');
      const arrow = job.jobType === 'download' ? '⬇' : '⬆';
      const prof = this.profiles.find(p => p.id === job.profileId);
      const profName = prof ? prof.name : (job.profileId || 'Default');

      const nextRunDisplay = job.enabled ? (job.nextRun || (job.frequency === 'startup' ? 'On App Startup' : 'Pending')) : 'Disabled';

      tr.innerHTML = `
        <td style="font-weight: 600;">${job.name}</td>
        <td style="font-family: var(--font-mono); font-size: 11px;">⚡ ${profName}</td>
        <td style="font-weight: 600;">${arrow} ${job.jobType.toUpperCase()}</td>
        <td style="font-size: 11px;">${this.getFrequencyLabel(job)}</td>
        <td style="font-family: var(--font-mono); font-size: 11px;">${nextRunDisplay}</td>
        <td>${this.getStatusBadge(job)}</td>
        <td style="text-align: center; white-space: nowrap;">
          <div style="display: flex; gap: 4px; justify-content: center;">
            <button class="btn btn-qaction" title="Run Job Now" onclick="window.ScheduledJobs.runJobNow('${job.id}')">⚡ Run</button>
            <button class="btn btn-qaction" title="${job.enabled ? 'Pause Job' : 'Enable Job'}" onclick="window.ScheduledJobs.toggleJob('${job.id}', ${job.enabled})">${job.enabled ? '⏸️' : '▶️'}</button>
            <button class="btn btn-qaction" title="Edit Job" onclick="window.ScheduledJobs.openJobModal(window.ScheduledJobs.jobs.find(j => j.id === '${job.id}'))">✏️</button>
            <button class="btn btn-qaction btn-qdanger" title="Delete Job" onclick="window.ScheduledJobs.deleteJob('${job.id}')">🗑</button>
          </div>
        </td>
      `;
      this.tbody.appendChild(tr);
    });
  }
};
