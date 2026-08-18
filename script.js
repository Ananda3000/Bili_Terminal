(function () {
  const feedEl = document.getElementById('feed');
  const statusEl = document.getElementById('statusText');
  const statusLineEl = statusEl.parentElement;
  const emptyStateEl = document.getElementById('emptyState');
  const searchInput = document.getElementById('searchInput');
  const refreshBtn = document.getElementById('refreshBtn');
  const pillsContainer = document.getElementById('categoryPills');
  const clockEl = document.getElementById('clock');

  let allArticles = [];
  let currentCategory = 'all';
  let currentSearch = '';
  let autoRefreshTimer = null;

  const CATEGORY_LABELS = {
    marches: 'Marchés',
    forex: 'Forex',
    actions: 'Actions',
    'matieres-premieres': 'Matières 1ères',
    economie: 'Économie',
    crypto: 'Crypto',
  };

  function updateClock() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('fr-FR');
  }
  updateClock();
  setInterval(updateClock, 1000);

  function timeAgo(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "à l'instant";
    if (diffMin < 60) return `il y a ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `il y a ${diffH} h`;
    const diffD = Math.floor(diffH / 24);
    return `il y a ${diffD} j`;
  }

  function renderSkeletons(count = 9) {
    feedEl.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const sk = document.createElement('div');
      sk.className = 'skeleton';
      sk.innerHTML = `
        <div class="skeleton-image"></div>
        <div class="skeleton-line" style="width: 80%"></div>
        <div class="skeleton-line" style="width: 60%"></div>
        <div class="skeleton-line" style="width: 40%"></div>
      `;
      feedEl.appendChild(sk);
    }
  }

  function cardTemplate(article) {
    const catLabel = CATEGORY_LABELS[article.category] || article.category;
    const imageHtml = article.image
      ? `<img class="card-image" src="${escapeHtml(article.image)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=&quot;card-image-placeholder&quot;>◆</div>'" />`
      : `<div class="card-image-placeholder">◆</div>`;

    return `
      <article class="card">
        ${imageHtml}
        <div class="card-body">
          <div class="card-meta">
            <span class="card-source">${escapeHtml(article.source)}</span>
            <span class="card-category">${escapeHtml(catLabel)}</span>
          </div>
          <h3 class="card-title">${escapeHtml(article.title)}</h3>
          <p class="card-excerpt">${escapeHtml(article.excerpt)}</p>
          <div class="card-footer">
            <span class="card-time">${timeAgo(article.publishedAt)}</span>
            <a class="card-link" href="${escapeAttr(article.link)}" target="_blank" rel="noopener noreferrer">Lire l'article ↗</a>
          </div>
        </div>
      </article>
    `;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    return escapeHtml(str);
  }

  function applyFilters() {
    let filtered = allArticles;
    if (currentCategory !== 'all') {
      filtered = filtered.filter((a) => a.category === currentCategory);
    }
    if (currentSearch.trim()) {
      const q = currentSearch.trim().toLowerCase();
      filtered = filtered.filter(
        (a) =>
          (a.title && a.title.toLowerCase().includes(q)) ||
          (a.excerpt && a.excerpt.toLowerCase().includes(q)) ||
          (a.source && a.source.toLowerCase().includes(q))
      );
    }
    renderArticles(filtered);
  }

  function renderArticles(articles) {
    if (!articles.length) {
      feedEl.innerHTML = '';
      emptyStateEl.classList.remove('hidden');
      return;
    }
    emptyStateEl.classList.add('hidden');
    feedEl.innerHTML = articles.map(cardTemplate).join('');
  }

  async function loadNews() {
    refreshBtn.classList.add('spinning');
    statusLineEl.classList.remove('error');
    try {
      const res = await fetch('/api/news', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      allArticles = data.articles || [];
      const updated = data.updatedAt ? new Date(data.updatedAt).toLocaleTimeString('fr-FR') : '';
      let msg = `${allArticles.length} articles • actualisé à ${updated}`;
      if (data.failedFeeds && data.failedFeeds.length) {
        msg += ` • ${data.failedFeeds.length} source(s) indisponible(s)`;
      }
      statusEl.textContent = msg;
      applyFilters();
    } catch (err) {
      statusLineEl.classList.add('error');
      statusEl.textContent = "Impossible de charger les actualités pour le moment. Nouvelle tentative dans 30s...";
      console.error(err);
      setTimeout(loadNews, 30000);
    } finally {
      refreshBtn.classList.remove('spinning');
    }
  }

  // Events
  pillsContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.pill');
    if (!btn) return;
    document.querySelectorAll('.pill').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    currentCategory = btn.dataset.category;
    applyFilters();
  });

  let searchDebounce = null;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      currentSearch = e.target.value;
      applyFilters();
    }, 200);
  });

  refreshBtn.addEventListener('click', () => loadNews());

  // Initial load
  renderSkeletons();
  loadNews();

  // Auto-refresh every 5 minutes
  autoRefreshTimer = setInterval(loadNews, 5 * 60 * 1000);
})();
