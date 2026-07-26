const { getLastGifIndex, setLastGifIndex } = require('./storage');

const KLIPY_BASE_URL = 'https://api.klipy.com/api/v1';
const GIF_QUERY = 'birthday meme';
const RESULT_POOL_SIZE = 10;

async function getRandomBirthdayGif() {
  const appKey = process.env.KLIPY_API_KEY;
  if (!appKey) {
    console.log('KLIPY_API_KEY not set, skipping birthday gif.');
    return null;
  }

  try {
    const url = `${KLIPY_BASE_URL}/${appKey}/gifs/search?q=${encodeURIComponent(GIF_QUERY)}&per_page=${RESULT_POOL_SIZE}&customer_id=whatsapp-birthday-bot`;
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`Klipy search failed with status ${res.status}, skipping gif.`);
      return null;
    }

    const body = await res.json();
    const results = body?.data?.data ?? [];
    if (!results.length) return null;

    const lastIndex = getLastGifIndex();
    let index;
    do {
      index = Math.floor(Math.random() * results.length);
    } while (results.length > 1 && index === lastIndex);
    setLastGifIndex(index);

    const pick = results[index];
    // WhatsApp's gifPlayback expects an actual mp4 video to loop, not a .gif image file.
    return pick?.file?.md?.mp4?.url || null;
  } catch (err) {
    console.log('Error fetching birthday gif:', err.message);
    return null;
  }
}

module.exports = { getRandomBirthdayGif };
