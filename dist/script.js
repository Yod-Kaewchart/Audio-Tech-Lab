const menuButton = document.querySelector('.menu-toggle');
const menu = document.querySelector('#primary-nav');

function closeMenu() {
  menu.classList.remove('is-open');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'เปิดเมนูนำทาง');
}

menuButton.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  menu.classList.toggle('is-open', !isOpen);
  menuButton.setAttribute('aria-expanded', String(!isOpen));
  menuButton.setAttribute('aria-label', isOpen ? 'เปิดเมนูนำทาง' : 'ปิดเมนูนำทาง');
});

menu.addEventListener('click', (event) => {
  if (event.target.closest('a')) closeMenu();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenu();
});

window.matchMedia('(min-width: 801px)').addEventListener('change', closeMenu);

const previewDialog = document.querySelector('#demo-preview-dialog');
if (previewDialog && typeof previewDialog.showModal === 'function') {
  const previewImage = document.querySelector('#demo-preview-image');
  const previewTitle = document.querySelector('#demo-preview-title');
  const previewFull = document.querySelector('#demo-preview-full');
  const previewStatus = document.querySelector('#demo-preview-status');
  let previewOpener;
  document.querySelectorAll('.demo-home-preview').forEach(link => {
    link.addEventListener('click', event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      previewOpener = link;
      previewTitle.textContent = 'ภาพตัวอย่าง ' + link.dataset.previewTitle;
      previewImage.alt = 'ภาพหน้าจอ ' + link.dataset.previewTitle + ' ของ Audio Tech Labs';
      previewImage.hidden = true;
      previewStatus.hidden = false;
      previewStatus.textContent = 'กำลังโหลดภาพตัวอย่าง…';
      previewFull.href = link.href;
      previewImage.src = link.href;
      document.body.classList.add('demo-preview-open');
      previewDialog.showModal();
    });
  });
  previewImage.addEventListener('load', () => {
    previewImage.hidden = false;
    previewStatus.hidden = true;
  });
  previewImage.addEventListener('error', () => {
    if (!previewDialog.open) return;
    previewStatus.hidden = false;
    previewStatus.textContent = 'โหลดภาพไม่สำเร็จ ลองเปิดภาพขนาดเต็มอีกครั้ง';
  });
  previewDialog.querySelector('.demo-preview-close').addEventListener('click', () => previewDialog.close());
  previewDialog.addEventListener('click', event => {
    if (event.target !== previewDialog) return;
    const bounds = previewDialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) previewDialog.close();
  });
  previewDialog.addEventListener('close', () => {
    document.body.classList.remove('demo-preview-open');
    previewOpener?.focus({ preventScroll: true });
  });
}
