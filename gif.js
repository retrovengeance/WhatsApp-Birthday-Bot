const KLIPY_SEARCH_URL = 'https://api.klipy.co/api/v1/gifs/search';
const GIF_QUERY = 'birthday meme';
const RESULT_POOL_SIZE = 10;

async function getRandomBirthdayGif() {
  const apiKey = process.env.KLIPY_API_KEY;
  if (!apiKey) {
    console.log('KLIPY_API_KEY not set, skipping birthday gif.');
    return null;
  }

  try {
    const url = `${KLIPY_SEARCH_URL}?api_key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(GIF_QUERY)}&limit=${RESULT_POOL_SIZE}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`Klipy search failed with status ${res.status}, skipping gif.`);
      return null;
    }

    const body = await res.json();
    const results = body?.data ?? [];
    if (!results.length) return null;

    // NOTE: verify this field path against Klipy's actual response schema once a real API key is wired up.
    const pick = results[Math.floor(Math.random() * results.length)];
    return pick?.file?.md?.gif?.url || pick?.url || null;
  } catch (err) {
    console.log('Error fetching birthday gif:', err.message);
    return null;
  }
}

module.exports = { getRandomBirthdayGif };
