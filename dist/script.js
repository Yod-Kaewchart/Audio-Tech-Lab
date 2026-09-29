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
