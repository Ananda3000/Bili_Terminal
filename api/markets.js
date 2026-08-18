const INSTRUMENTS = [
  { symbol: 'SPY', label: 'S&P 500', note: 'ETF SPY' },
  { symbol: 'QQQ', label: 'Nasdaq 100', note: 'ETF QQQ' },
  { symbol: 'DIA', label: 'Dow Jones', note: 'ETF DIA' },
  { symbol: 'VIXY', label: 'Volatilité (VIX)', note: 'proxy ETF' },
  { symbol: 'UUP', label: 'Dollar Index (DXY)', note: 'proxy ETF' },
  { symbol: 'GLD', label: 'Or', note: 'ETF GLD' },
  { symbol: 'EUR/USD', label: 'EUR/USD', note: 'forex' },
  { symbol: 'TLT', label: 'Taux longs US', note: 'proxy ETF (inverse)' },
];

module.exports = async (req, res) => {
  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (!apiKey) {
    res.status(200).json({
      configured: false,
      message:
        "Aucune clé API configurée. Ajoute la variable d'environnement TWELVE_DATA_API_KEY dans les réglages Vercel du projet, puis redéploie.",
      instruments: [],
    });
    return;
  }

  try {
    const symbols = INSTRUMENTS.map((i) => i.symbol).join(',');
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbols)}&apikey=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    // Twelve Data renvoie soit { SYMBOL: {...}, SYMBOL2: {...} } pour plusieurs
    // symboles, soit directement un objet plat pour un seul symbole.
    const isMulti = INSTRUMENTS.length > 1 && !data.symbol;

    const instruments = INSTRUMENTS.map(({ symbol, label, note }) => {
      const quote = isMulti ? data[symbol] : data;

      if (!quote || quote.status === 'error' || quote.code) {
        return {
          symbol,
          label,
          note,
          available: false,
          error: (quote && (quote.message || quote.status)) || 'indisponible',
        };
      }

      return {
        symbol,
        label,
        note,
        available: true,
        price: quote.close !== undefined ? Number(quote.close) : null,
        change: quote.change !== undefined ? Number(quote.change) : null,
        percentChange: quote.percent_change !== undefined ? Number(quote.percent_change) : null,
        currency: quote.currency || null,
        datetime: quote.datetime || null,
      };
    });

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    res.status(200).json({
      configured: true,
      updatedAt: new Date().toISOString(),
      instruments,
    });
  } catch (err) {
    res.status(500).json({
      configured: true,
      error: 'Erreur lors de la récupération des données de marché',
      details: String(err),
      instruments: [],
    });
  }
};
