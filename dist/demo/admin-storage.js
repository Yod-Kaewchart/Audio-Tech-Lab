let storageRequest=0;

const adminStoragePanel = document.querySelector('#admin-storage-panel'), adminStorageList = document.querySelector('#admin-storage-list'), adminStorageSummary = document.querySelector('#admin-storage-summary');
function storageSize(bytes) { if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'; if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'; return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'; }
async function loadAdminStorage() {
  if (window.demoAuth?.user.role !== 'admin') return;
  const auth = window.demoAuth, request = ++storageRequest;
  adminStorageSummary.textContent = 'Loading storage...'; adminStorageList.replaceChildren();
  try {
    const value = await authRequest('/admin/storage'), now = Date.now();
    if (auth !== window.demoAuth || request !== storageRequest) return;
    adminStorageSummary.textContent = value.items.length + ' items · ' + storageSize(value.items.reduce((n, item) => n + item.size, 0)) + ' · Auto cleanup 59 min';
    for (const item of value.items) {
      const row = document.createElement('div'); row.className = 'uploaded-file-row';
      const info = document.createElement('div'), title = document.createElement('strong'), meta = document.createElement('small');
      title.textContent = item.type === 'upload' ? item.name : 'Export ' + item.id.slice(0, 8);
      const remaining = Math.max(0, Math.ceil((value.retentionMs - (now - item.modified)) / 60000));
      meta.textContent = item.username + ' · ' + item.type.toUpperCase() + ' · ' + storageSize(item.size) + ' · cleanup ~' + remaining + ' min' + (item.busy ? ' · PROCESSING' : '');
      info.append(title, meta); const button = document.createElement('button'); button.type = 'button'; button.textContent = item.busy ? 'In use' : 'Delete'; button.disabled = item.busy;
      button.addEventListener('click', async () => { if (!confirm('Delete this ' + item.type + ' from Server?')) return; button.disabled = true; try { await authRequest('/admin/storage/delete', { type: item.type, ownerId: item.ownerId, id: item.id }); window.demoResourcesChanged(); await loadAdminStorage(); } catch (error) { adminStorageSummary.textContent = error.message; button.disabled = false; } });
      row.append(info, button); adminStorageList.append(row);
    }
  } catch (error) { adminStorageSummary.textContent = error.message; }
}
document.querySelector('#refresh-admin-storage').addEventListener('click', loadAdminStorage);
