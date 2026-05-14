const BASE_URL = 'https://nathforyou.github.io/survie-mc';
const SERVER_IP = 'serveurmc.servehttp.com';
const SERVER_STATUS_API = `https://api.mcsrvstat.us/3/${SERVER_IP}`;

const newsList = document.querySelector('#newsList');
const voteLinks = document.querySelector('#voteLinks');
const statusBox = document.querySelector('.server-status');
const serverStatus = document.querySelector('#serverStatus');
const playerCount = document.querySelector('#playerCount');
const voteButton = document.querySelector('#voteButton');

async function loadAll() {
  await Promise.allSettled([loadTheme(), loadNews(), loadVotes(), loadServerStatus()]);
}

async function loadTheme() {
  const theme = await fetchJson(`${BASE_URL}/theme.json`);
  if (theme?.colors) {
    const root = document.documentElement;
    if (theme.colors.accent) root.style.setProperty('--accent', theme.colors.accent);
    if (theme.colors.accentStrong) root.style.setProperty('--accent-strong', theme.colors.accentStrong);
    if (theme.colors.card) root.style.setProperty('--card', theme.colors.card);
    if (theme.colors.panel) root.style.setProperty('--panel', theme.colors.panel);
    if (theme.colors.muted) root.style.setProperty('--muted', theme.colors.muted);
  }
  if (theme?.hero) {
    document.querySelector('#themeEyebrow').textContent = theme.hero.eyebrow || 'Survie Mc';
    document.querySelector('#themeTitle').textContent = 'Survie Mc mobile';
    document.querySelector('#themeSubtitle').textContent = theme.hero.subtitle || 'Teste les liens et les actualites sans lancer Minecraft.';
  }
}

async function loadNews() {
  const news = await fetchJson(`${BASE_URL}/news.json`);
  if (!Array.isArray(news) || news.length === 0) {
    newsList.innerHTML = '<div class="empty">Aucune actualite disponible.</div>';
    return;
  }
  newsList.innerHTML = news.map((item) => `
    <article class="news-card">
      <time>${escapeHtml(item.date || '')}</time>
      <h3>${escapeHtml(item.title || 'Actualite')}</h3>
      <p>${escapeHtml(item.body || '')}</p>
    </article>
  `).join('');
}

async function loadVotes() {
  const links = await fetchJson(`${BASE_URL}/vote-links.json`);
  if (!Array.isArray(links) || links.length === 0) {
    voteLinks.innerHTML = '<div class="empty">Aucun lien de vote configure.</div>';
    return;
  }
  voteButton.href = links[0].url;
  voteLinks.innerHTML = links.map((link) => `
    <a class="link-card" href="${escapeAttribute(link.url)}">
      <h3>${escapeHtml(link.label || 'Vote')}</h3>
      <p>${escapeHtml(link.description || link.url)}</p>
    </a>
  `).join('');
}

async function loadServerStatus() {
  try {
    const data = await fetchJson(SERVER_STATUS_API);
    if (data?.online) {
      statusBox.classList.add('online');
      serverStatus.textContent = 'En ligne';
      playerCount.textContent = `${data.players?.online ?? 0}/${data.players?.max ?? 0} joueurs`;
    } else {
      statusBox.classList.remove('online');
      serverStatus.textContent = 'Hors ligne';
      playerCount.textContent = SERVER_IP;
    }
  } catch {
    statusBox.classList.remove('online');
    serverStatus.textContent = 'Statut indisponible';
    playerCount.textContent = SERVER_IP;
  }
}

async function fetchJson(url) {
  const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Impossible de charger ${url}`);
  return response.json();
}

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll(' ', '%20');
}

function showToast(text) {
  document.querySelector('.toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = text;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1600);
}

document.querySelector('#refreshButton').addEventListener('click', loadAll);
document.querySelector('#copyIpButton').addEventListener('click', async () => {
  await navigator.clipboard.writeText(SERVER_IP);
  showToast('IP copiee');
});

loadAll();
setInterval(loadServerStatus, 30000);
