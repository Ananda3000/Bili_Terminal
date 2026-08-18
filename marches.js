(function () {
  const statsGrid = document.getElementById('statsGrid');
  const statusEl = document.getElementById('statusText');
  const configBanner = document.getElementById('configBanner');
  const refreshBtn = document.getElementById('refreshBtn');
  const clockEl = document.getElementById('clock');

  function updateClock() {
    clockEl.textContent = new Date().toLocaleTimeString('fr-FR');
  }
  updateClock();
  setInterval(updateClock, 1000);

  function formatPrice(value, currency) {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    const decimals = value < 10 ? 4 : 2;
    const formatted = value.toLocaleString('fr-FR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return currency && currency !== 'USD' ? `${formatted} ${currency}` : `$${formatted}`;
  }

  function tileTemplate(item) {
    if (!item.available) {
      return `
        <div class="stat-tile unavailable">
          <div class="stat-label">
            <span>${escapeHtml(item.label)}</span>
            <span class="stat-note">${escapeHtml(item.note || '')}</span>
          </div>
          <div class="stat-unavailable-text">Indisponible pour le moment</div>
        </div>
      `;
    }

    const pct = item.percentChange;
    const direction = pct > 0 ? 'positive' : pct < 0 ? 'negative' : 'neutral';
    const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '·';
    const pctText = pct !== null && pct !== undefined ? `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%` : '—';

    return `
      <div class="stat-tile">
        <div class="stat-label">
          <span>${escapeHtml(item.label)}</span>
          <span class="stat-note">${escapeHtml(item.note || '')}</span>
        </div>
        <div class="stat-value">${formatPrice(item.price, item.currency)}</div>
        <div class="stat-delta ${direction}">${arrow} ${pctText}</div>
      </div>
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

  async function loadMarkets() {
    refreshBtn.classList.add('spinning');
    try {
      const res = await fetch('/api/markets', { cache: 'no-store' });
      const data = await res.json();

      if (!data.configured) {
        configBanner.classList.remove('hidden');
        configBanner.innerHTML = `<strong>Configuration requise :</strong> ${escapeHtml(data.message || '')}`;
        statusEl.textContent = 'En attente de configuration...';
        statsGrid.innerHTML = '';
        return;
      }

      configBanner.classList.add('hidden');
      const updated = data.updatedAt ? new Date(data.updatedAt).toLocaleTimeString('fr-FR') : '';
      statusEl.textContent = `Actualisé à ${updated}`;
      statsGrid.innerHTML = (data.instruments || []).map(tileTemplate).join('');
    } catch (err) {
      statusEl.textContent = 'Impossible de charger les données de marché. Nouvelle tentative dans 30s...';
      console.error(err);
      setTimeout(loadMarkets, 30000);
    } finally {
      refreshBtn.classList.remove('spinning');
    }
  }

  refreshBtn.addEventListener('click', loadMarkets);
  loadMarkets();
  setInterval(loadMarkets, 60 * 1000);
})();
