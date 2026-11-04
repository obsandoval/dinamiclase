/* ==========================
 * Dinamiclase — JS con barra lateral y control de collapses
 * ========================== */

(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const sidebar  = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggleSidebar');

    // Inicia colapsada en escritorio (≥992px)
    if (sidebar && window.innerWidth >= 992) {
      sidebar.classList.add('collapsed');
      if (toggleBtn) {
        const i = toggleBtn.querySelector('i');
        const label = toggleBtn.querySelector('.label');
        if (i) i.className = 'bi bi-layout-sidebar'; // icono contraído
        toggleBtn.title = 'Expandir';
        if (label) label.textContent = 'Expandir';
      }
    }

    // Toggle de barra lateral (desktop)
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');

        const i = toggleBtn.querySelector('i');
        const label = toggleBtn.querySelector('.label');

        if (sidebar.classList.contains('collapsed')) {
          if (i) i.className = 'bi bi-layout-sidebar';
          toggleBtn.title = 'Expandir barra lateral';
          if (label) label.textContent = 'Expandir';
        } else {
          if (i) i.className = 'bi bi-layout-sidebar-inset-reverse';
          toggleBtn.title = 'Contraer barra lateral';
          if (label) label.textContent = 'Barra lateral';
        }
      });
    }

    // Asegurar que los textos descriptivos estén siempre expandidos en escritorio
    if (window.innerWidth >= 992) {
      document.querySelectorAll('.collapse').forEach(el => {
        el.classList.add('show');
      });
    }
  });
})();
