const SUPABASE_URL = 'REMPLACE_PAR_TON_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'REMPLACE_PAR_TON_SUPABASE_ANON_KEY';

const configured = SUPABASE_URL.startsWith('https://') && !SUPABASE_ANON_KEY.startsWith('REMPLACE');
const db = configured ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const elements = {
  setupBox: document.querySelector('#setupBox'),
  adminToggle: document.querySelector('#adminToggle'),
  closeAdmin: document.querySelector('#closeAdmin'),
  adminPanel: document.querySelector('#adminPanel'),
  pollForm: document.querySelector('#pollForm'),
  pollsList: document.querySelector('#pollsList'),
  refreshButton: document.querySelector('#refreshButton'),
  template: document.querySelector('#pollTemplate')
};

let voterId = localStorage.getItem('survie-mc-voter-id');
if (!voterId) {
  voterId = crypto.randomUUID();
  localStorage.setItem('survie-mc-voter-id', voterId);
}

if (!configured) elements.setupBox.classList.remove('hidden');

elements.adminToggle.addEventListener('click', () => elements.adminPanel.classList.remove('hidden'));
elements.closeAdmin.addEventListener('click', () => elements.adminPanel.classList.add('hidden'));
elements.refreshButton.addEventListener('click', loadPolls);

elements.pollForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!db) return alert('Configure Supabase dans votes.js avant de publier.');

  const payload = {
    admin_password: document.querySelector('#adminPassword').value,
    poll_title: document.querySelector('#pollTitle').value.trim(),
    poll_mod_name: document.querySelector('#modName').value.trim(),
    poll_description: document.querySelector('#pollDescription').value.trim(),
    poll_mod_url: document.querySelector('#modUrl').value.trim()
  };

  const { error } = await db.rpc('create_poll', payload);
  if (error) return alert(error.message);

  elements.pollForm.reset();
  elements.adminPanel.classList.add('hidden');
  await loadPolls();
});

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

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

loadPolls();
