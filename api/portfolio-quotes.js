// Réutilise la même clé Twelve Data que la page Marchés (TWELVE_DATA_API_KEY).
// Contrairement à api/markets.js (liste fixe), ici les symboles sont ceux que
// l'utilisateur a ajoutés à son portefeuille (stocké dans son navigateur),
// transmis via ?symbols=AAPL,MSFT,BTC/USD

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

  const raw = (req.query && req.query.symbols) || '';
  const symbols = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 25); // limite raisonnable pour rester dans le quota gratuit

  if (!symbols.length) {
    res.status(200).json({ configured: true, quotes: {} });
    return;
  }

  try {
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbols.join(','))}&apikey=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    const isMulti = symbols.length > 1 && !data.symbol;

    const quotes = {};
    symbols.forEach((symbol) => {
      const quote = isMulti ? data[symbol] : data;
      if (!quote || quote.status === 'error' || quote.code) {
        quotes[symbol] = { available: false, error: (quote && (quote.message || quote.status)) || 'indisponible' };
        return;
      }
      quotes[symbol] = {
        available: true,
        price: quote.close !== undefined ? Number(quote.close) : null,
        percentChange: quote.percent_change !== undefined ? Number(quote.percent_change) : null,
        currency: quote.currency || null,
        name: quote.name || null,
      };
    });

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    res.status(200).json({ configured: true, updatedAt: new Date().toISOString(), quotes });
  } catch (err) {
    res.status(500).json({ configured: true, error: 'Erreur lors de la récupération des cours', details: String(err), quotes: {} });
  }
};
