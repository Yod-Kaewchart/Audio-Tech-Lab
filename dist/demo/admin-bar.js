
const adminBadge = document.querySelector('#admin-badge'), accountToggle = document.querySelector('#account-toggle'), storageToggle = document.querySelector('#storage-toggle');
const adminUsersList = document.querySelector('#admin-users-list'), adminUsersStatus = document.querySelector('#admin-users-status');
async function loadAdminUsers() {
  if (!window.demoAuth?.user || window.demoAuth.user.role !== 'admin') return;
  adminUsersStatus.textContent = 'กำลังโหลดบัญชี…';
  try {
    const value = await authRequest('/admin/users');
    const users = value.users.filter(user => user.role !== 'admin');
    adminUsersList.replaceChildren();
    if (!users.length) { adminUsersStatus.textContent = 'ยังไม่มีบัญชีผู้ใช้'; return; }
    adminUsersStatus.textContent = users.length + ' บัญชี';
    for (const user of users) {
      const row = document.createElement('div'); row.className = 'admin-user-row';
      const info = document.createElement('div'); info.className = 'admin-user-info';
      const name = document.createElement('strong'); name.textContent = user.username;
      const email = document.createElement('span'); email.textContent = user.email || 'ไม่มีอีเมล';
      info.append(name, email);
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'admin-user-delete'; remove.textContent = 'ลบบัญชี';
      remove.addEventListener('click', async () => {
        if (!confirm('ลบบัญชี “' + user.username + '” ? ผู้ใช้นี้จะออกจากระบบทันที')) return;
        remove.disabled = true;
        try {
          await authRequest('/admin/users/' + encodeURIComponent(user.id), { __delete: true }, 'DELETE');
          await loadAdminUsers(); if (typeof loadAdminStorage === 'function') loadAdminStorage();
        } catch (error) { adminUsersStatus.textContent = error.message; remove.disabled = false; }
      });
      row.append(info, remove); adminUsersList.append(row);
    }
  } catch (error) { adminUsersStatus.textContent = error.message; }
}
function syncAdminControls(value) {
  const admin = Boolean(value?.user?.role === 'admin' && !value.user.mustChange);
  adminBadge.hidden = !admin; accountToggle.hidden = !admin; storageToggle.hidden = !admin;
  if (!admin) { adminPanel.open = false; adminStoragePanel.open = false; }
}
accountToggle.addEventListener('click', () => { adminPanel.open = !adminPanel.open; if (adminPanel.open) { adminStoragePanel.open = false; loadAdminUsers(); } });
storageToggle.addEventListener('click', () => { adminStoragePanel.open = !adminStoragePanel.open; if (adminStoragePanel.open) { adminPanel.open = false; loadAdminStorage(); } });
document.querySelector('#refresh-admin-users').addEventListener('click', loadAdminUsers);
