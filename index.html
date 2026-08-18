const Parser = require('rss-parser');

const parser = new Parser({
  timeout: 8000,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MonTerminalNewsBot/1.0)' },
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail'],
      ['enclosure', 'enclosure'],
    ],
  },
});

// Flux RSS publics et gratuits (aucune clé API nécessaire).
// Si un flux tombe en panne, il est simplement ignoré (Promise.allSettled).
const FEEDS = [
  { url: 'https://www.investing.com/rss/news.rss', source: 'Investing.com', category: 'marches' },
  { url: 'https://www.investing.com/rss/forex.rss', source: 'Investing.com', category: 'forex' },
  { url: 'https://www.investing.com/rss/commodities.rss', source: 'Investing.com', category: 'matieres-premieres' },
  { url: 'https://www.investing.com/rss/stock_market.rss', source: 'Investing.com', category: 'actions' },
  { url: 'https://www.investing.com/rss/economic_indicators.rss', source: 'Investing.com', category: 'economie' },
  { url: 'https://feeds.marketwatch.com/marketwatch/topstories/', source: 'MarketWatch', category: 'marches' },
  { url: 'https://investinglive.com/feed', source: 'InvestingLive', category: 'forex' },
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', source: 'CoinDesk', category: 'crypto' },
  { url: 'https://cointelegraph.com/rss', source: 'Cointelegraph', category: 'crypto' },
];

function extractImage(item) {
  try {
    if (item.enclosure && item.enclosure.url) return item.enclosure.url;
    if (item.mediaContent && item.mediaContent.length) {
      const withUrl = item.mediaContent.find((m) => m.$ && m.$.url);
      if (withUrl) return withUrl.$.url;
    }
    if (item.mediaThumbnail && item.mediaThumbnail.$ && item.mediaThumbnail.$.url) {
      return item.mediaThumbnail.$.url;
    }
    // Essaye d'extraire une image depuis le HTML du contenu, si présent
    const html = item['content:encoded'] || item.content || '';
    const match = /<img[^>]+src="([^">]+)"/i.exec(html);
    if (match) return match[1];
  } catch (e) {
    // ignore
  }
  return null;
}

function cleanText(text, maxLen = 220) {
  if (!text) return '';
  const stripped = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  return stripped.length > maxLen ? stripped.slice(0, maxLen).trim() + '…' : stripped;
}

async function fetchFeed(feed) {
  const parsed = await parser.parseURL(feed.url);
  return (parsed.items || []).map((item) => ({
    title: cleanText(item.title, 160),
    link: item.link,
    source: feed.source,
    category: feed.category,
    excerpt: cleanText(item.contentSnippet || item.content || item.summary || ''),
    image: extractImage(item),
    publishedAt: item.isoDate || item.pubDate || null,
  }));
}

module.exports = async (req, res) => {
  try {
    const results = await Promise.allSettled(FEEDS.map(fetchFeed));

    let articles = [];
    results.forEach((r) => {
      if (r.status === 'fulfilled') {
        articles = articles.concat(r.value);
      }
    });

    // Déduplique par lien
    const seen = new Set();
    articles = articles.filter((a) => {
      if (!a.link || seen.has(a.link)) return false;
      seen.add(a.link);
      return true;
    });

    // Trie du plus récent au plus ancien
    articles.sort((a, b) => {
      const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return dateB - dateA;
    });

    // Limite raisonnable
    articles = articles.slice(0, 150);

    const failedFeeds = results
      .map((r, i) => (r.status === 'rejected' ? FEEDS[i].source : null))
      .filter(Boolean);

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json({
      updatedAt: new Date().toISOString(),
      count: articles.length,
      failedFeeds,
      articles,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des actualités', details: String(err) });
  }
};
