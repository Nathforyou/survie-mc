const SUPABASE_URL = 'https://jtviivafcmiaddjavndw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_w0_KQ3mOK2HP5-tx-rcZoQ_tjc94rrQ';
const ADMIN_EMAIL = 'nathanfernandesfrere9@gmail.com';

const configured = SUPABASE_URL.startsWith('https://') && !SUPABASE_ANON_KEY.startsWith('REMPLACE');
const db = configured ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const elements = {
  setupBox: document.querySelector('#setupBox'),
  adminToggle: document.querySelector('#adminToggle'),
  closeAdmin: document.querySelector('#closeAdmin'),
  adminPanel: document.querySelector('#adminPanel'),
  adminStatus: document.querySelector('#adminStatus'),
  googleLogin: document.querySelector('#googleLogin'),
  googleLogout: document.querySelector('#googleLogout'),
  pollForm: document.querySelector('#pollForm'),
  pollsList: document.querySelector('#pollsList'),
  refreshButton: document.querySelector('#refreshButton'),
  template: document.querySelector('#pollTemplate')
};

let currentUser = null;
let isAdmin = false;
let voterId = localStorage.getItem('survie-mc-voter-id');
if (!voterId) {
  voterId = crypto.randomUUID();
  localStorage.setItem('survie-mc-voter-id', voterId);
}

if (!configured) elements.setupBox.classList.remove('hidden');

elements.adminToggle.addEventListener('click', () => elements.adminPanel.classList.remove('hidden'));
elements.closeAdmin.addEventListener('click', () => elements.adminPanel.classList.add('hidden'));
elements.refreshButton.addEventListener('click', loadPolls);
elements.googleLogin.addEventListener('click', loginWithGoogle);
elements.googleLogout.addEventListener('click', logout);

elements.pollForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!db) return alert('Configure Supabase dans votes.js avant de publier.');
  if (!isAdmin) return alert('Connecte-toi avec le compte Google admin.');

  const payload = {
    poll_title: document.querySelector('#pollTitle').value.trim(),
    poll_mod_name: document.querySelector('#modName').value.trim(),
    poll_description: document.querySelector('#pollDescription').value.trim(),
    poll_mod_url: normalizeUrl(document.querySelector('#modUrl').value.trim())
  };

  const { error } = await db.rpc('create_poll', payload);
  if (error) return alert(error.message);

  elements.pollForm.reset();
  await loadPolls();
});

if (db) {
  db.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user ?? null;
    refreshAdminState();
  });
}

async function initAuth() {
  if (!db) return;
  const { data } = await db.auth.getSession();
  currentUser = data.session?.user ?? null;
  await refreshAdminState();
}

async function refreshAdminState() {
  isAdmin = false;

  if (!currentUser) {
    elements.adminStatus.textContent = 'Connexion Google requise.';
    elements.googleLogin.classList.remove('hidden');
    elements.googleLogout.classList.add('hidden');
    elements.pollForm.classList.add('hidden');
    await loadPolls();
    return;
  }

  const email = currentUser.email || '';
  const { data, error } = await db.rpc('is_vote_admin');
  isAdmin = !error && data === true;

  elements.googleLogin.classList.add('hidden');
  elements.googleLogout.classList.remove('hidden');

  if (isAdmin) {
    elements.adminStatus.textContent = `Connecte en admin: ${email}`;
    elements.pollForm.classList.remove('hidden');
  } else {
    elements.adminStatus.textContent = `Connecte avec ${email}, mais ce compte nest pas admin.`;
    elements.pollForm.classList.add('hidden');
  }

  await loadPolls();
}

async function loginWithGoogle() {
  if (!db) return alert('Configure Supabase avant la connexion Google.');
  const { error } = await db.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.href.split('#')[0]
    }
  });
  if (error) alert(error.message);
}

async function logout() {
  if (!db) return;
  await db.auth.signOut();
  currentUser = null;
  await refreshAdminState();
}

async function loadPolls() {
  if (!db) {
    elements.pollsList.innerHTML = '<div class="empty">Le site est pret, mais Supabase nest pas encore configure.</div>';
    return;
  }

  elements.pollsList.innerHTML = '<div class="empty">Chargement des votes...</div>';
  const { data, error } = await db.from('poll_results').select('*').eq('active', true).order('created_at', { ascending: false });

  if (error) {
    elements.pollsList.innerHTML = `<div class="empty">Erreur: ${escapeHtml(error.message)}</div>`;
    return;
  }

  if (!data || data.length === 0) {
    elements.pollsList.innerHTML = '<div class="empty">Aucun vote ouvert pour le moment.</div>';
    return;
  }

  elements.pollsList.innerHTML = '';
  data.forEach(renderPoll);
}

function renderPoll(poll) {
  const node = elements.template.content.firstElementChild.cloneNode(true);
  const total = Number(poll.yes_votes) + Number(poll.no_votes);
  const yesPercent = total > 0 ? Math.round((Number(poll.yes_votes) / total) * 100) : 0;
  const noPercent = total > 0 ? 100 - yesPercent : 0;

  node.querySelector('.mod-name').textContent = poll.mod_name;
  node.querySelector('h3').textContent = poll.title;
  node.querySelector('p').textContent = poll.description || 'Vote pour dire si tu veux ce mod dans la survie.';
  node.querySelector('.total-votes').textContent = `${total} vote${total > 1 ? 's' : ''}`;
  node.querySelector('.yes-count').textContent = `${poll.yes_votes} (${yesPercent}%)`;
  node.querySelector('.no-count').textContent = `${poll.no_votes} (${noPercent}%)`;
  node.querySelector('.yes-bar').style.width = `${yesPercent}%`;
  node.querySelector('.no-bar').style.width = `${noPercent}%`;

  const link = node.querySelector('.mod-link');
  if (poll.mod_url) link.href = poll.mod_url;
  else link.remove();

  const deleteButton = node.querySelector('.delete-poll-button');
  if (isAdmin) {
    deleteButton.classList.remove('hidden');
    deleteButton.addEventListener('click', () => deletePoll(poll.id, poll.title));
  }

  node.querySelector('.yes-button').addEventListener('click', () => vote(poll.id, true));
  node.querySelector('.no-button').addEventListener('click', () => vote(poll.id, false));
  elements.pollsList.appendChild(node);
}

async function vote(pollId, value) {
  if (!db) return alert('Configure Supabase dans votes.js avant de voter.');

  const { error } = await db.rpc('cast_vote', {
    poll_id: pollId,
    voter_id: voterId,
    vote_yes: value
  });

  if (error) return alert(error.message);
  await loadPolls();
}

async function deletePoll(pollId, title) {
  if (!isAdmin) return alert('Connecte-toi avec le compte Google admin.');
  if (!confirm(`Supprimer le vote "${title}" ?`)) return;

  const { error } = await db.rpc('delete_poll', { poll_id: pollId });
  if (error) return alert(error.message);
  await loadPolls();
}

function normalizeUrl(value) {
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return `https://${value}`;
}

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

initAuth();
loadPolls();
