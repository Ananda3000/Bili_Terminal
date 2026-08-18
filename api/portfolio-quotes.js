// Réutilise la même clé Twelve Data que la page Marchés (TWELVE_DATA_API_KEY).
// Contrairement à api/markets.js (liste fixe), ici les symboles sont ceux que
// l'utilisateur a ajoutés à son portefeuille (stocké dans son navigateur).
//
// Deux façons d'appeler cette fonction :
//   ?symbols=AAPL,MSFT,BTC/USD                          (simple, valeurs US/forex/crypto)
//   ?items=[{"symbol":"6857","exchange":"Japan"}, ...]   (avec bourse précisée, pour les valeurs internationales)
//
// Twelve Data attend le ticker "nu" (ex: 6857, pas 6857.T) et lève l'ambiguïté
// avec un paramètre exchange/country séparé. Les items avec bourse précisée
// sont donc interrogés un par un (l'API ne permet pas un paramètre exchange
// différent par symbole dans un même appel groupé).

async function fetchQuote(params, apiKey) {
  const url = `https://api.twelvedata.com/quote?${params}&apikey=${apiKey}`;
  const response = await fetch(url);
  return response.json();
}

module.exports = async (req, res) => {
  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (!apiKey) {
    res.status(200).json({
      configured: false,
      message:
        "Aucune clé API configurée. Ajoute la variable d'environnement TWELVE_DATA_API_KEY dans les réglages Vercel du projet (déjà fait pour la page Marchés normalement).",
      quotes: {},
    });
    return;
  }

  let items = [];
  const rawItems = req.query && req.query.items;
  const rawSymbols = req.query && req.query.symbols;

  if (rawItems) {
    try {
      items = JSON.parse(rawItems);
    } catch (e) {
      items = [];
    }
  } else if (rawSymbols) {
    items = rawSymbols
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((symbol) => ({ symbol }));
  }

  items = items.filter((i) => i && i.symbol).slice(0, 25); // limite raisonnable pour rester dans le quota gratuit

  if (!items.length) {
    res.status(200).json({ configured: true, quotes: {} });
    return;
  }

  const simpleItems = items.filter((i) => !i.exchange && !i.country);
  const disambiguatedItems = items.filter((i) => i.exchange || i.country);

  const quotes = {};

  try {
    // Groupe 1 : symboles simples (US, forex, crypto) en un seul appel groupé
    if (simpleItems.length) {
      const symbols = simpleItems.map((i) => i.symbol);
      const data = await fetchQuote(`symbol=${encodeURIComponent(symbols.join(','))}`, apiKey);
      const isMulti = symbols.length > 1 && !data.symbol;

      symbols.forEach((symbol) => {
        const quote = isMulti ? data[symbol] : data;
        quotes[symbol] = parseQuote(quote);
      });
    }

    // Groupe 2 : symboles avec bourse précisée, interrogés individuellement
    if (disambiguatedItems.length) {
      const results = await Promise.allSettled(
        disambiguatedItems.slice(0, 8).map((item) => {
          const parts = [`symbol=${encodeURIComponent(item.symbol)}`];
          if (item.exchange) parts.push(`exchange=${encodeURIComponent(item.exchange)}`);
          if (item.country) parts.push(`country=${encodeURIComponent(item.country)}`);
          return fetchQuote(parts.join('&'), apiKey).then((data) => ({ symbol: item.symbol, data }));
        })
      );
      results.forEach((r, idx) => {
        const symbol = disambiguatedItems[idx].symbol;
        if (r.status === 'fulfilled') {
          quotes[symbol] = parseQuote(r.value.data);
        } else {
          quotes[symbol] = { available: false, error: 'indisponible' };
        }
      });
    }

    // Récupère un taux de change vers l'USD pour chaque devise non-USD présente,
    // pour que le total du portefeuille additionne des valeurs comparables
    // (un prix en JPY ne peut pas être additionné tel quel à un prix en USD).
    const currencies = Array.from(
      new Set(
        Object.values(quotes)
          .filter((q) => q.available && q.currency && q.currency !== 'USD')
          .map((q) => q.currency)
      )
    );

    const fxRates = {};
    if (currencies.length) {
      const fxResults = await Promise.allSettled(
        currencies.map((cur) => fetchQuote(`symbol=${encodeURIComponent(cur + '/USD')}`, apiKey).then((data) => ({ cur, data })))
      );
      fxResults.forEach((r, idx) => {
        const cur = currencies[idx];
        if (r.status === 'fulfilled' && r.value.data && r.value.data.close) {
          fxRates[cur] = Number(r.value.data.close);
        }
      });
    }

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    res.status(200).json({ configured: true, updatedAt: new Date().toISOString(), quotes, fxRates });
  } catch (err) {
    res.status(500).json({ configured: true, error: 'Erreur lors de la récupération des cours', details: String(err), quotes: {} });
  }
};

function parseQuote(quote) {
  if (!quote || quote.status === 'error' || quote.code) {
    return { available: false, error: (quote && (quote.message || quote.status)) || 'indisponible' };
  }
  return {
    available: true,
    price: quote.close !== undefined ? Number(quote.close) : null,
    percentChange: quote.percent_change !== undefined ? Number(quote.percent_change) : null,
    currency: quote.currency || null,
    name: quote.name || null,
  };
}
