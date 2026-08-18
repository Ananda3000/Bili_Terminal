(function () {
  const STORAGE_KEY = 'monterminal_portfolio_v1';

  const clockEl = document.getElementById('clock');
  const statusEl = document.getElementById('statusText');
  const configBanner = document.getElementById('configBanner');
  const refreshBtn = document.getElementById('refreshBtn');
  const totalValueEl = document.getElementById('totalValue');
  const totalDeltaEl = document.getElementById('totalDelta');
  const addForm = document.getElementById('addForm');
  const symbolInput = document.getElementById('symbolInput');
  const exchangeInput = document.getElementById('exchangeInput');
  const nameInput = document.getElementById('nameInput');
  const qtyInput = document.getElementById('qtyInput');
  const priceInput = document.getElementById('priceInput');
  const holdingsBody = document.getElementById('holdingsBody');
  const emptyPortfolio = document.getElementById('emptyPortfolio');
  const newsStatusText = document.getElementById('newsStatusText');
  const portfolioFeed = document.getElementById('portfolioFeed');
  const emptyNews = document.getElementById('emptyNews');

  function updateClock() {
    clockEl.textContent = new Date().toLocaleTimeString('fr-FR');
  }
  updateClock();
  setInterval(updateClock, 1000);

  function loadHoldings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveHoldings(holdings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings));
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatMoney(value) {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  let holdings = loadHoldings();
  let quotesCache = {};
  let fxRatesCache = {};

  function currencySymbol(currency) {
    if (!currency || currency === 'USD') return '$';
    if (currency === 'EUR') return '€';
    if (currency === 'GBP') return '£';
    if (currency === 'JPY') return '¥';
    return currency + ' ';
  }

  function toUsd(value, currency) {
    if (value === null) return null;
    if (!currency || currency === 'USD') return value;
    const rate = fxRatesCache[currency];
    return rate ? value * rate : null; // pas de taux dispo -> exclu du total plutôt que faussé
  }

  function renderHoldings() {
    if (!holdings.length) {
      holdingsBody.innerHTML = '';
      emptyPortfolio.classList.remove('hidden');
      totalValueEl.textContent = '$0.00';
      totalDeltaEl.textContent = '—';
      totalDeltaEl.className = 'stat-delta neutral';
      document.getElementById('totalValueNote').textContent = '';
      return;
    }
    emptyPortfolio.classList.add('hidden');

    let totalValue = 0;
    let weightedChangeSum = 0;

    let excludedFromTotal = false;

    const rows = holdings.map((h, idx) => {
      const quote = quotesCache[h.symbol];
      const price = quote && quote.available ? quote.price : null;
      const pct = quote && quote.available ? quote.percentChange : null;
      const currency = quote && quote.available ? quote.currency : null;
      const symbol = currencySymbol(currency);
      const value = price !== null ? price * h.quantity : null;
      const valueUsd = value !== null ? toUsd(value, currency) : null;

      if (value !== null) {
        if (valueUsd !== null) {
          totalValue += valueUsd;
          if (pct !== null) weightedChangeSum += valueUsd * pct;
        } else {
          excludedFromTotal = true;
        }
      }

      let plValue = null;
      if (price !== null && h.avgPrice) {
        plValue = (price - h.avgPrice) * h.quantity;
      }

      const dayDirection = pct > 0 ? 'positive' : pct < 0 ? 'negative' : 'neutral';
      const dayArrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '·';
      const dayText = pct !== null && pct !== undefined ? `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%` : '—';

      const plDirection = plValue > 0 ? 'positive' : plValue < 0 ? 'negative' : 'neutral';
      const plText = plValue !== null ? `${plValue > 0 ? '+' : ''}${symbol}${formatMoney(plValue)}` : '—';

      return `
        <tr>
          <td>
            <div class="holding-symbol">${escapeHtml(h.symbol)}</div>
            ${h.name || h.exchange ? `<div class="holding-name">${escapeHtml([h.name, h.exchange].filter(Boolean).join(' · '))}</div>` : ''}
          </td>
          <td>${h.quantity}</td>
          <td>${price !== null ? symbol + formatMoney(price) : (quote && !quote.available ? 'indisponible' : '…')}</td>
          <td>${value !== null ? symbol + formatMoney(value) : '—'}</td>
          <td class="stat-delta ${dayDirection}">${dayText === '—' ? '—' : dayArrow + ' ' + dayText}</td>
          <td class="stat-delta ${plDirection}">${plText}</td>
          <td><button class="delete-btn" data-idx="${idx}" title="Supprimer">🗑</button></td>
        </tr>
      `;
    });

    holdingsBody.innerHTML = rows.join('');
    totalValueEl.textContent = '$' + formatMoney(totalValue) + (excludedFromTotal ? ' *' : '');
    document.getElementById('totalValueNote').textContent = excludedFromTotal
      ? '* un ou plusieurs actifs en devise étrangère sont exclus du total (taux de change indisponible pour le moment)'
      : '';

    if (totalValue > 0) {
      const blendedPct = weightedChangeSum / totalValue;
      const direction = blendedPct > 0 ? 'positive' : blendedPct < 0 ? 'negative' : 'neutral';
      const arrow = blendedPct > 0 ? '▲' : blendedPct < 0 ? '▼' : '·';
      totalDeltaEl.textContent = `${arrow} ${blendedPct > 0 ? '+' : ''}${blendedPct.toFixed(2)}% aujourd'hui`;
      totalDeltaEl.className = `stat-delta ${direction}`;
    } else {
      totalDeltaEl.textContent = '—';
      totalDeltaEl.className = 'stat-delta neutral';
    }

    holdingsBody.querySelectorAll('.delete-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.idx);
        holdings.splice(idx, 1);
        saveHoldings(holdings);
        renderHoldings();
      });
    });
  }

  async function loadQuotes() {
    if (!holdings.length) {
      renderHoldings();
      return;
    }
    refreshBtn.classList.add('spinning');
    try {
      const items = holdings.map((h) => ({ symbol: h.symbol, exchange: h.exchange || undefined }));
      const res = await fetch(`/api/portfolio-quotes?items=${encodeURIComponent(JSON.stringify(items))}`, { cache: 'no-store' });
      const data = await res.json();

      if (!data.configured) {
        configBanner.classList.remove('hidden');
        configBanner.innerHTML = `<strong>Configuration requise :</strong> ${escapeHtml(data.message || '')}`;
        statusEl.textContent = 'En attente de configuration...';
        return;
      }
      configBanner.classList.add('hidden');
      quotesCache = data.quotes || {};
      fxRatesCache = data.fxRates || {};
      const updated = data.updatedAt ? new Date(data.updatedAt).toLocaleTimeString('fr-FR') : '';
      statusEl.textContent = updated ? `Actualisé à ${updated}` : '—';
      renderHoldings();
    } catch (err) {
      statusEl.textContent = 'Impossible de charger les cours.';
      console.error(err);
    } finally {
      refreshBtn.classList.remove('spinning');
    }
  }

  function newsCardTemplate(article) {
    return `
      <article class="card">
        ${article.image ? `<img class="card-image" src="${escapeHtml(article.image)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=&quot;card-image-placeholder&quot;>◆</div>'" />` : `<div class="card-image-placeholder">◆</div>`}
        <div class="card-body">
          <div class="card-meta">
            <span class="card-source">${escapeHtml(article.source)}</span>
            <span class="card-category">${escapeHtml(article.matchedSymbol)}</span>
          </div>
          <h3 class="card-title">${escapeHtml(article.title)}</h3>
          <p class="card-excerpt">${escapeHtml(article.excerpt)}</p>
          <div class="card-footer">
            <span class="card-time"></span>
            <a class="card-link" href="${escapeHtml(article.link)}" target="_blank" rel="noopener noreferrer">Lire l'article ↗</a>
          </div>
        </div>
      </article>
    `;
  }

  async function loadPortfolioNews() {
    if (!holdings.length) {
      portfolioFeed.innerHTML = '';
      newsStatusText.textContent = 'Ajoute des actifs pour voir leurs actualités ici.';
      emptyNews.classList.add('hidden');
      return;
    }
    newsStatusText.textContent = 'Recherche des actualités liées à ton portefeuille…';
    try {
      const res = await fetch('/api/news', { cache: 'no-store' });
      const data = await res.json();
      const articles = data.articles || [];

      const keywords = [];
      holdings.forEach((h) => {
        keywords.push({ key: h.symbol, needle: h.symbol.toLowerCase() });
        if (h.name) keywords.push({ key: h.symbol, needle: h.name.toLowerCase() });
      });

      const matched = [];
      articles.forEach((a) => {
        const haystack = `${a.title} ${a.excerpt}`.toLowerCase();
        const hit = keywords.find((k) => haystack.includes(k.needle));
        if (hit) {
          matched.push({ ...a, matchedSymbol: hit.key });
        }
      });

      if (!matched.length) {
        portfolioFeed.innerHTML = '';
        emptyNews.classList.remove('hidden');
        newsStatusText.textContent = `0 article trouvé sur ${articles.length} passés en revue.`;
        return;
      }

      emptyNews.classList.add('hidden');
      newsStatusText.textContent = `${matched.length} article(s) trouvé(s).`;
      portfolioFeed.innerHTML = matched.slice(0, 30).map(newsCardTemplate).join('');
    } catch (err) {
      newsStatusText.textContent = 'Impossible de charger les actualités.';
      console.error(err);
    }
  }

  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const symbol = symbolInput.value.trim().toUpperCase();
    const exchange = exchangeInput.value.trim();
    const name = nameInput.value.trim();
    const quantity = parseFloat(qtyInput.value);
    const avgPrice = priceInput.value ? parseFloat(priceInput.value) : null;

    if (!symbol || !quantity || quantity <= 0) return;

    holdings.push({ symbol, exchange, name, quantity, avgPrice });
    saveHoldings(holdings);
    addForm.reset();
    loadQuotes();
    loadPortfolioNews();
  });

  refreshBtn.addEventListener('click', () => {
    loadQuotes();
    loadPortfolioNews();
  });

  renderHoldings();
  loadQuotes();
  loadPortfolioNews();
  setInterval(loadQuotes, 60 * 1000);
})();
