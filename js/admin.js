let periodesCache = [];
let grilleTarifsCache = [];
let semainesCache = [];
let inscriptionsCache = [];
let editionJours = null; // { inscription, semaines, joursInitiaux } pendant la modification des jours

// ── Mot de passe ──────────────────────────────────────────────────────────────

async function checkMdpAdmin() {
  const input = document.getElementById('mdp-input');
  const btn   = document.getElementById('btn-mdp');
  const err   = document.getElementById('mdp-error');
  const val   = input.value;

  btn.disabled    = true;
  btn.textContent = '...';

  const { data: ok, error } = await sb.rpc('verify_mdp_admin', { mdp: val });

  btn.disabled    = false;
  btn.textContent = 'Accéder →';

  if (error) { showToast('Erreur : ' + error.message); return; }

  if (ok === true) {
    sessionStorage.setItem('admin_auth', '1');
    document.getElementById('mdp-section').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'block';
    await loadPeriodes();
    await loadGrilleTarifs();
  } else {
    err.style.display = 'block';
    input.value = '';
    input.focus();
    setTimeout(() => { err.style.display = 'none'; }, 2500);
  }
}

function logoutAdmin() { sessionStorage.removeItem('admin_auth'); location.reload(); }

window.addEventListener('DOMContentLoaded', async () => {
  if (sessionStorage.getItem('admin_auth') === '1') {
    document.getElementById('mdp-section').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'block';
    await loadPeriodes();
    await loadGrilleTarifs();
  } else {
    document.getElementById('mdp-input').focus();
  }
});

// ── Onglets ───────────────────────────────────────────────────────────────────

function switchAdminTab(tab) {
  document.getElementById('panel-periodes').style.display    = tab === 'periodes'    ? 'block' : 'none';
  document.getElementById('panel-inscriptions').style.display = tab === 'inscriptions' ? 'block' : 'none';
  document.getElementById('tab-periodes').classList.toggle('active', tab === 'periodes');
  document.getElementById('tab-inscriptions').classList.toggle('active', tab === 'inscriptions');
}

function formatDateFr(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Périodes ──────────────────────────────────────────────────────────────────

async function loadPeriodes() {
  const { data, error } = await sb.rpc('admin_list_periodes');
  if (error) { showToast('Erreur : ' + error.message); return; }

  periodesCache = data || [];
  renderPeriodesList();
  renderPeriodesSelect();
}

function renderPeriodesList() {
  const el = document.getElementById('periodes-admin-list');
  if (!periodesCache.length) {
    el.innerHTML = '<div class="empty-state"><p>Aucune période créée</p></div>';
    return;
  }
  el.innerHTML = periodesCache.map(p => `
    <div class="periode-row ${p.actif ? '' : 'inactif'}">
      <div>
        <div class="periode-row-titre">${p.nom}</div>
        <div class="periode-row-sub">${p.lieu ? p.lieu + ' — ' : ''}${p.actif ? 'Visible sur le site' : 'Masquée'}</div>
      </div>
      <div class="periode-row-actions">
        <button class="btn-sm-grey" onclick="editPeriode('${p.id}')">✎ Modifier</button>
        <button class="btn-sm-red" onclick="deletePeriode('${p.id}')">🗑</button>
      </div>
    </div>
  `).join('');
}

function renderPeriodesSelect() {
  const options = '<option value="">— Choisir une période —</option>' +
    periodesCache.map(p => `<option value="${p.id}">${p.nom}</option>`).join('');

  const sel = document.getElementById('inscriptions-periode-select');
  const previous = sel.value;
  sel.innerHTML = options;
  if (previous) sel.value = previous;

  const selSemaines = document.getElementById('semaines-periode-select');
  const previousSemaines = selSemaines.value;
  selSemaines.innerHTML = options;
  if (previousSemaines) selSemaines.value = previousSemaines;
}

function editPeriode(id) {
  const p = periodesCache.find(x => x.id === id);
  if (!p) return;
  document.getElementById('periode-form-title').textContent = 'Modifier la période';
  document.getElementById('p-id').value = p.id;
  document.getElementById('p-nom').value = p.nom;
  document.getElementById('p-lieu').value = p.lieu ?? '';
  document.getElementById('p-ordre').value = p.ordre ?? 0;
  document.getElementById('p-actif').checked = p.actif;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetFormPeriode() {
  document.getElementById('periode-form-title').textContent = 'Nouvelle période';
  document.getElementById('p-id').value = '';
  document.getElementById('p-nom').value = '';
  document.getElementById('p-lieu').value = '';
  document.getElementById('p-ordre').value = 0;
  document.getElementById('p-actif').checked = true;
}

async function savePeriode() {
  const id    = document.getElementById('p-id').value || null;
  const nom   = document.getElementById('p-nom').value.trim();
  const lieu  = document.getElementById('p-lieu').value.trim() || null;
  const ordre = Number(document.getElementById('p-ordre').value) || 0;
  const actif = document.getElementById('p-actif').checked;

  if (!nom) return showToast('Merci de remplir le nom de la période');

  const { error } = await sb.rpc('admin_upsert_periode', {
    p_id: id, p_nom: nom, p_lieu: lieu, p_ordre: ordre, p_actif: actif
  });

  if (error) return showToast('Erreur : ' + error.message);

  showToast('Période enregistrée ✅');
  resetFormPeriode();
  await loadPeriodes();
}

async function deletePeriode(id) {
  if (!confirm('Supprimer cette période et toutes ses inscriptions ?')) return;
  const { error } = await sb.rpc('admin_delete_periode', { p_id: id });
  if (error) return showToast('Erreur : ' + error.message);
  showToast('Période supprimée');
  await loadPeriodes();
}

// ── Semaines ──────────────────────────────────────────────────────────────────

async function loadSemaines() {
  const periodeId = document.getElementById('semaines-periode-select').value;
  const el = document.getElementById('semaines-admin-list');

  if (!periodeId) {
    semainesCache = [];
    el.innerHTML = '<div class="empty-state"><p>Sélectionnez une période</p></div>';
    return;
  }

  const { data, error } = await sb.rpc('admin_list_semaines', { p_periode_id: periodeId });
  if (error) { showToast('Erreur : ' + error.message); return; }

  semainesCache = data || [];
  renderSemainesList();
}

function renderSemainesList() {
  const el = document.getElementById('semaines-admin-list');
  if (!semainesCache.length) {
    el.innerHTML = '<div class="empty-state"><p>Aucune semaine créée</p></div>';
    return;
  }
  el.innerHTML = semainesCache.map(s => `
    <div class="periode-row">
      <div>
        <div class="periode-row-titre">${s.nom}</div>
        <div class="periode-row-sub">Du ${formatDateFr(s.date_debut)} au ${formatDateFr(s.date_fin)} — ${s.capacite ?? 24} places</div>
      </div>
      <div class="periode-row-actions">
        <button class="btn-sm-grey" onclick="editSemaine('${s.id}')">✎ Modifier</button>
        <button class="btn-sm-red" onclick="deleteSemaine('${s.id}')">🗑</button>
      </div>
    </div>
  `).join('');
}

function editSemaine(id) {
  const s = semainesCache.find(x => x.id === id);
  if (!s) return;
  document.getElementById('s-id').value = s.id;
  document.getElementById('s-nom').value = s.nom;
  document.getElementById('s-date-debut').value = s.date_debut;
  document.getElementById('s-date-fin').value = s.date_fin;
  document.getElementById('s-ordre').value = s.ordre ?? 0;
  document.getElementById('s-capacite').value = s.capacite ?? 24;
  window.scrollTo({ top: document.getElementById('semaines-periode-select').getBoundingClientRect().top + window.scrollY - 20, behavior: 'smooth' });
}

function resetFormSemaine() {
  document.getElementById('s-id').value = '';
  document.getElementById('s-nom').value = '';
  document.getElementById('s-date-debut').value = '';
  document.getElementById('s-date-fin').value = '';
  document.getElementById('s-ordre').value = 0;
  document.getElementById('s-capacite').value = 24;
}

async function saveSemaine() {
  const periodeId = document.getElementById('semaines-periode-select').value;
  if (!periodeId) return showToast('Merci de choisir une période');

  const id        = document.getElementById('s-id').value || null;
  const nom       = document.getElementById('s-nom').value.trim();
  const dateDebut = document.getElementById('s-date-debut').value;
  const dateFin   = document.getElementById('s-date-fin').value;
  const ordre     = Number(document.getElementById('s-ordre').value) || 0;
  const capacite  = Number(document.getElementById('s-capacite').value) || 24;

  if (!nom || !dateDebut || !dateFin) return showToast('Merci de remplir le nom et les dates');

  const { error } = await sb.rpc('admin_upsert_semaine', {
    p_id: id, p_periode_id: periodeId, p_nom: nom, p_date_debut: dateDebut, p_date_fin: dateFin, p_ordre: ordre, p_capacite: capacite
  });

  if (error) return showToast('Erreur : ' + error.message);

  showToast('Semaine enregistrée ✅');
  resetFormSemaine();
  await loadSemaines();
}

async function deleteSemaine(id) {
  if (!confirm('Supprimer cette semaine ?')) return;
  const { error } = await sb.rpc('admin_delete_semaine', { p_id: id });
  if (error) return showToast('Erreur : ' + error.message);
  showToast('Semaine supprimée');
  await loadSemaines();
}

// ── Grille tarifaire ──────────────────────────────────────────────────────────

async function loadGrilleTarifs() {
  const { data, error } = await sb.from('grille_tarifs').select('*').order('nb_jours');
  if (error) { showToast('Erreur : ' + error.message); return; }
  grilleTarifsCache = data || [];
  renderGrilleTarifs();
}

function renderGrilleTarifs() {
  const el = document.getElementById('grille-tarifs-list');
  if (!el) return;
  el.innerHTML = grilleTarifsCache.map(t => `
    <div class="tarif-row">
      <label>${t.nb_jours} jour${t.nb_jours > 1 ? 's' : ''}</label>
      <div style="display:flex;align-items:center;gap:6px;">
        <input type="number" id="tarif-${t.nb_jours}" value="${t.prix}" min="0" step="0.01"/>
        <span class="tarif-euro">€</span>
        <button class="btn-sm-grey" onclick="saveTarif(${t.nb_jours})">✓</button>
      </div>
    </div>
  `).join('');
}

async function saveTarif(nbJours) {
  const val = Number(document.getElementById('tarif-' + nbJours).value);
  const { error } = await sb.rpc('admin_set_tarif', { p_nb_jours: nbJours, p_prix: val });
  if (error) return showToast('Erreur : ' + error.message);
  showToast('Tarif ' + nbJours + ' jour(s) mis à jour ✅');
  await loadGrilleTarifs();
}

// ── Inscriptions ──────────────────────────────────────────────────────────────

async function loadInscriptions() {
  const periodeId  = document.getElementById('inscriptions-periode-select').value;
  const attenteEl = document.getElementById('inscriptions-attente');
  const payesEl   = document.getElementById('inscriptions-payes');
  const statsEl   = document.getElementById('inscriptions-stats');
  statsEl.innerHTML = '';

  if (!periodeId) {
    attenteEl.innerHTML = '<div class="empty-state"><p>Sélectionnez une période</p></div>';
    payesEl.innerHTML   = '<div class="empty-state"><p>—</p></div>';
    return;
  }

  const [{ data, error }, { data: semaines }] = await Promise.all([
    sb.rpc('admin_list_inscriptions', { p_periode_id: periodeId }),
    sb.rpc('admin_list_semaines', { p_periode_id: periodeId }),
  ]);
  if (error) { showToast('Erreur : ' + error.message); return; }

  inscriptionsCache = data || [];
  statsEl.innerHTML = renderStatsPeriode(inscriptionsCache, semaines || []);

  if (!data?.length) {
    attenteEl.innerHTML = '<div class="empty-state"><p>Aucun pré-inscrit</p></div>';
    payesEl.innerHTML   = '<div class="empty-state"><p>Aucun inscrit</p></div>';
    return;
  }

  const periode = periodesCache.find(p => p.id === periodeId);
  const enAttente = data.filter(i => !i.paye);
  const payes     = data.filter(i => i.paye);

  attenteEl.innerHTML = enAttente.length
    ? enAttente.map(i => renderInscritRow(i, periode)).join('')
    : '<div class="empty-state"><p>Aucun pré-inscrit</p></div>';

  payesEl.innerHTML = payes.length
    ? payes.map(i => renderInscritRow(i, periode)).join('')
    : '<div class="empty-state"><p>Aucun inscrit</p></div>';
}

// Récapitulatif d'une période : présents par semaine (un enfant compte s'il
// a au moins un jour dans la semaine), dont payés / non payés, détail par
// jour ; puis paiements encaissés et à encaisser (nombre et montant).
function renderStatsPeriode(inscriptions, semaines) {
  if (!inscriptions.length) return '';
  const euros = (n) => n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €';
  const jourCourt = (j) => new Date(j + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });

  const cartesSemaines = [...semaines]
    .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0) || String(a.date_debut).localeCompare(String(b.date_debut)))
    .map((s) => {
      const debut = String(s.date_debut).slice(0, 10);
      const fin = String(s.date_fin).slice(0, 10);
      const dansSemaine = (j) => j >= debut && j <= fin;
      const presents = inscriptions.filter((i) => (i.jours_selectionnes || []).some(dansSemaine));
      const payes = presents.filter((i) => i.paye).length;
      // présents par jour de la semaine
      const parJour = {};
      presents.forEach((i) => (i.jours_selectionnes || []).filter(dansSemaine).forEach((j) => { parJour[j] = (parJour[j] || 0) + 1; }));
      const jours = Object.keys(parJour).sort();
      return `
        <div class="stat-card">
          <div class="stat-titre">${escapeHtml(s.nom)}</div>
          <div class="stat-dates">du ${new Date(debut + 'T00:00:00').toLocaleDateString('fr-FR')} au ${new Date(fin + 'T00:00:00').toLocaleDateString('fr-FR')}</div>
          <div class="stat-chiffre">${presents.length} <small>présent${presents.length > 1 ? 's' : ''}${s.capacite ? ' / ' + s.capacite + ' places' : ''}</small></div>
          <div class="stat-ligne"><span class="ok">${payes} payé${payes > 1 ? 's' : ''}</span> · <span class="att">${presents.length - payes} non payé${presents.length - payes > 1 ? 's' : ''}</span></div>
          ${jours.length ? `<div class="stat-jours">${jours.map((j) => `<span class="stat-jour">${jourCourt(j)} : ${parJour[j]}</span>`).join('')}</div>` : ''}
        </div>`;
    }).join('');

  const payes = inscriptions.filter((i) => i.paye);
  const attente = inscriptions.filter((i) => !i.paye);
  const somme = (l) => l.reduce((t, i) => t + (Number(i.montant) || 0), 0);

  return `
    <div class="stats-grid">
      ${cartesSemaines}
      <div class="stat-card total">
        <div class="stat-titre">Paiements</div>
        <div class="stat-dates">${inscriptions.length} inscription${inscriptions.length > 1 ? 's' : ''} sur la période</div>
        <div class="stat-ligne"><span class="ok">Encaissés : ${payes.length}</span> · ${euros(somme(payes))}</div>
        <div class="stat-ligne"><span class="att">À encaisser : ${attente.length}</span> · ${euros(somme(attente))}</div>
        <div class="stat-ligne">Total attendu : <strong style="color:#fff;">${euros(somme(inscriptions))}</strong></div>
      </div>
    </div>`;
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInscritRow(i, periode) {
  const nbJours = i.jours_selectionnes?.length || 0;
  const joursLabel = nbJours
    ? nbJours + ' jour' + (nbJours > 1 ? 's' : '') + ' (' + i.jours_selectionnes.map(j => new Date(j + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })).join(', ') + ')'
    : '—';
  return `
    <div class="inscrit-row ${i.paye ? 'paye' : ''}" id="inscrit-${i.id}">
      <div>
        <div class="inscrit-nom">${escapeHtml(i.prenom)} ${escapeHtml(i.nom)}</div>
        <div class="inscrit-meta">${escapeHtml(i.email)}${i.telephone ? ' · ' + escapeHtml(i.telephone) : ''}${i.nom_parent ? ' · Parent : ' + escapeHtml(i.nom_parent) : ''}</div>
        <div class="inscrit-meta">${joursLabel}${i.tarif_reduit ? ' · tarif réduit -20%' : ''} · <strong style="color:#fff;">${i.montant != null ? i.montant + ' €' : '—'}</strong></div>
        <div class="inscrit-meta">Pré-inscrit le ${new Date(i.date_inscription).toLocaleDateString('fr-FR')}</div>
        <div class="inscrit-meta">
          ${i.autorisation_sortie ? '✅' : '❌'} Sortie
          · ${i.autorisation_intervention ? '✅' : '❌'} Intervention urgence
          · ${i.droit_image ? '✅' : '❌'} Droit image
          ${i.sait_nager != null ? '· ' + (i.sait_nager ? '✅' : '❌') + ' Sait nager' : ''}
        </div>
        ${i.probleme_sante ? `<div class="inscrit-meta" style="color:#fc8181;font-weight:600;">⚠ Santé : ${escapeHtml(i.probleme_sante)}</div>` : ''}
        ${!i.paye && i.relances?.length ? `<div class="relances">${i.relances.map((d, n) =>
          `<div>✉ ${n === 0 ? '1<sup>re</sup>' : (n + 1) + '<sup>e</sup>'} relance envoyée le ${new Date(d).toLocaleDateString('fr-FR')}</div>`).join('')}</div>` : ''}
      </div>
      <div class="inscrit-actions">
        ${i.paye
          ? `<span class="badge-paye">✔ Payé</span>`
          : `<span class="badge-attente">En attente</span>
             <button class="btn-sm-green" onclick="marquerPaye('${i.id}', '${periode?.id}')">Cet adhérent a payé</button>
             <button class="btn-sm-orange" onclick="relancerPaiement('${i.id}')">${i.relances?.length ? '✉ Refaire une relance' : '✉ Relancer'}</button>`}
        <button class="btn-sm-gold" onclick="ouvrirEditionJours('${i.id}')">✎ Modifier les jours</button>
        <button class="btn-sm-red" onclick="supprimerInscription('${i.id}')">🗑 Supprimer</button>
      </div>
    </div>
  `;
}

async function marquerPaye(inscriptionId, periodeId) {
  const { data, error } = await sb.rpc('admin_marquer_paye', { p_id: inscriptionId, p_paye: true });
  if (error) { showToast('Erreur : ' + error.message); return; }

  const periode = periodesCache.find(p => p.id === periodeId);
  showToast('Adhérent marqué comme payé ✅');
  await envoyerEmailConfirmation(data, periode);
  await loadInscriptions();
}

async function supprimerInscription(inscriptionId) {
  if (!confirm('Supprimer définitivement cet adhérent ?')) return;
  const { error } = await sb.rpc('admin_delete_inscription', { p_id: inscriptionId });
  if (error) return showToast('Erreur : ' + error.message);
  showToast('Adhérent supprimé');
  await loadInscriptions();
}

// ── Modification des jours d'une inscription ──────────────────────────────────

// 'YYYY-MM-DD' en heure locale (toISOString() convertit en UTC et décale d'un jour
// en France — même piège que sur la page publique).
function toLocalISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Jours de semaine (lundi-vendredi) entre deux dates incluses
function joursOuvresSemaine(dateDebut, dateFin) {
  const jours = [];
  const d = new Date(dateDebut + 'T00:00:00');
  const fin = new Date(dateFin + 'T00:00:00');
  while (d <= fin) {
    if (d.getDay() >= 1 && d.getDay() <= 5) jours.push(toLocalISODate(d));
    d.setDate(d.getDate() + 1);
  }
  return jours;
}

function formatJourCourt(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function prixPourNbJours(nb) {
  const t = grilleTarifsCache.find(x => x.nb_jours === nb);
  if (t) return Number(t.prix);
  if (!grilleTarifsCache.length) return 0;
  return Number(grilleTarifsCache[grilleTarifsCache.length - 1].prix); // au-delà de la grille : dernier palier
}

// Même règle que la page d'inscription : grille dégressive appliquée semaine par
// semaine puis additionnée, -20% si tarif réduit.
function calculerMontantJours(jours, semaines, reduit) {
  let total = 0;
  semaines.forEach(s => {
    const nb = jours.filter(j => j >= s.date_debut && j <= s.date_fin).length;
    if (nb > 0) total += prixPourNbJours(nb);
  });
  total = Math.round(total * 100) / 100;
  return reduit ? Math.round(total * 0.8 * 100) / 100 : total;
}

function joursCoches() {
  return Array.from(document.querySelectorAll('.ej-jour:checked')).map(el => el.value).sort();
}

async function ouvrirEditionJours(inscriptionId) {
  const inscription = inscriptionsCache.find(i => i.id === inscriptionId);
  if (!inscription) return;

  if (!grilleTarifsCache.length) await loadGrilleTarifs();

  const { data: semaines, error } = await sb.rpc('admin_list_semaines', { p_periode_id: inscription.periode_id });
  if (error) return showToast('Erreur : ' + error.message);
  if (!semaines?.length) return showToast("Aucune semaine définie pour cette période");

  const joursInitiaux = (inscription.jours_selectionnes || []).slice().sort();
  editionJours = { inscription, semaines, joursInitiaux };
  const actuels = new Set(joursInitiaux);

  document.getElementById('modal-jours').innerHTML = `
    <div class="modal-jours-box">
      <h3>Modifier les jours</h3>
      <div class="sub">${escapeHtml(inscription.prenom)} ${escapeHtml(inscription.nom)}${inscription.paye ? ' · a déjà payé' : ' · en attente de paiement'}</div>
      ${semaines.map(s => `
        <div class="jours-semaine">
          <div class="jours-semaine-titre">${escapeHtml(s.nom)} — du ${formatDateFr(s.date_debut)} au ${formatDateFr(s.date_fin)}</div>
          <div class="jours-grid">
            ${joursOuvresSemaine(s.date_debut, s.date_fin).map(j => `
              <label class="jour-check">
                <input type="checkbox" class="ej-jour" value="${j}" ${actuels.has(j) ? 'checked' : ''} onchange="majMontantEdition()"/>
                ${formatJourCourt(j)}
              </label>`).join('')}
          </div>
        </div>`).join('')}
      <div class="montant-edition" id="edition-montant"></div>
      <div class="modal-jours-actions">
        <button class="btn-sm-grey" onclick="fermerEditionJours()">Annuler</button>
        <button class="btn-sm-green" onclick="enregistrerEditionJours()">Enregistrer</button>
      </div>
    </div>`;

  document.getElementById('modal-jours').classList.add('show');
  majMontantEdition();
}

function fermerEditionJours() {
  document.getElementById('modal-jours').classList.remove('show');
  document.getElementById('modal-jours').innerHTML = '';
  editionJours = null;
}

// Montant recalculé selon la grille actuelle, comparé à celui d'avant modification.
// Si le découpage des jours par semaine ne change pas le prix, on conserve le montant
// de l'inscription tel quel (cas d'une simple erreur de jour).
function etatMontantEdition() {
  const { inscription, semaines, joursInitiaux } = editionJours;
  const jours = joursCoches();
  const reduit = !!inscription.tarif_reduit;
  const avant = calculerMontantJours(joursInitiaux, semaines, reduit);
  const apres = calculerMontantJours(jours, semaines, reduit);
  return { jours, avant, apres, prixChange: apres !== avant, montantActuel: inscription.montant };
}

function majMontantEdition() {
  const el = document.getElementById('edition-montant');
  if (!el || !editionJours) return;

  const cocheAvant = document.getElementById('ej-maj-montant')?.checked || false;
  const { jours, apres, prixChange, montantActuel } = etatMontantEdition();
  const nbAvant = editionJours.joursInitiaux.length;

  if (!jours.length) {
    el.innerHTML = '<span style="color:#fc8181;">Sélectionnez au moins un jour</span>';
    return;
  }

  const euro = v => (v != null ? v + ' €' : '—');
  let html = `${jours.length} jour${jours.length > 1 ? 's' : ''} sélectionné${jours.length > 1 ? 's' : ''} (avant : ${nbAvant}).<br/>`;

  if (!prixChange) {
    html += `Le prix ne change pas : le montant reste <strong>${euro(montantActuel)}</strong>.`;
  } else {
    html += `Ce changement modifie le prix selon la grille.<br/>
      <label class="jour-check" style="margin-top:6px;">
        <input type="checkbox" id="ej-maj-montant" ${cocheAvant ? 'checked' : ''}/>
        Recalculer le montant : <s>${euro(montantActuel)}</s> → <strong>${apres} €</strong>
      </label>
      <span style="font-size:0.78rem;">Sinon, le montant actuel (${euro(montantActuel)}) est conservé.</span>`;
  }
  el.innerHTML = html;
}

async function enregistrerEditionJours() {
  if (!editionJours) return;
  const { inscription, joursInitiaux } = editionJours;
  const { jours, apres, prixChange } = etatMontantEdition();

  if (!jours.length) return showToast('Sélectionnez au moins un jour');
  if (jours.join() === joursInitiaux.join()) {
    fermerEditionJours();
    return showToast('Aucun changement');
  }

  const majMontant = prixChange && document.getElementById('ej-maj-montant')?.checked;

  const { error } = await sb.rpc('admin_update_jours_inscription', {
    p_id: inscription.id,
    p_jours: jours,
    p_montant: majMontant ? apres : null,
  });
  if (error) return showToast('Erreur : ' + error.message);

  fermerEditionJours();
  showToast('Jours modifiés ✅');
  await loadInscriptions();
}

async function envoyerEmailConfirmation(inscription, periode) {
  const jours = (inscription.jours_selectionnes || []).slice().sort();
  const joursLabel = jours.map(j => new Date(j + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })).join(', ');
  const periodeDates = jours.length ? ('du ' + formatDateFr(jours[0]) + ' au ' + formatDateFr(jours[jours.length - 1])) : '';

  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_PAIEMENT_ID, {
      to_email: inscription.email,
      to_name: inscription.prenom + ' ' + inscription.nom,
      periode_nom: periode?.nom || '',
      periode_dates: periodeDates,
      jours: joursLabel,
      montant: inscription.montant,
    });
  } catch (e) {
    showToast("Paiement enregistré, mais l'envoi du mail a échoué : vérifiez la config EmailJS");
  }
}

// ── Relance d'un adhérent qui n'a pas encore payé ─────────────────────────────

function texteRelance(inscription, periode) {
  const enfant = `${inscription.prenom} ${inscription.nom}`;
  const sujet = `Rappel : paiement du stage ${periode?.nom || ''} — ${enfant}`.replace(/\s+/g, ' ').trim();
  const message = [
    'Bonjour,',
    '',
    `Afin de finaliser l'inscription de votre enfant au stage ${periode?.nom || ''}, nous vous rappelons que vous devez régler la somme de : ${inscription.montant != null ? inscription.montant + ' €' : ''}`,
    'Cette somme doit nous parvenir impérativement avant le début du stage.',
    "Sans ce règlement nous ne serons pas en mesure d'accueillir votre enfant.",
    '',
    'Si vous nous avez déjà fait parvenir votre paiement merci de ne pas tenir compte de cette relance.',
    '',
    'Sportivement,',
    "L'équipe du RCFC",
  ].join('\n');
  return { sujet, message };
}

async function relancerPaiement(inscriptionId) {
  const inscription = inscriptionsCache.find(i => i.id === inscriptionId);
  if (!inscription) return;
  const periode = periodesCache.find(p => p.id === inscription.periode_id)
    || periodesCache.find(p => p.id === document.getElementById('inscriptions-periode-select').value);
  const { sujet, message } = texteRelance(inscription, periode);

  // sans template EmailJS : une fenêtre de rédaction Gmail s'ouvre avec l'e-mail rédigé
  if (!EMAILJS_TEMPLATE_RELANCE_ID) {
    const params = new URLSearchParams({ authuser: EMAIL_CLUB, view: 'cm', fs: '1', to: inscription.email, su: sujet, body: message });
    window.open('https://mail.google.com/mail/?' + params.toString(), '_blank');
    showToast('E-mail de relance prêt dans Gmail ✉');
    await enregistrerRelance(inscription.id);
    return;
  }

  if (!confirm(`Envoyer un e-mail de relance à ${inscription.email} ?\n\n${message}`)) return;
  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_RELANCE_ID, {
      to_email: inscription.email,
      to_name: inscription.nom_parent || (inscription.prenom + ' ' + inscription.nom),
      sujet,
      message,
    });
    showToast('Relance envoyée à ' + inscription.email + ' ✅');
    await enregistrerRelance(inscription.id);
  } catch (e) {
    showToast("L'envoi de la relance a échoué : vérifiez le template EmailJS");
  }
}

// date de la relance enregistrée sur la fiche ("1re relance envoyée le ...")
async function enregistrerRelance(inscriptionId) {
  const { error } = await sb.rpc('admin_ajouter_relance', { p_id: inscriptionId });
  if (error) { showToast("Relance prête, mais sa date n'a pas pu être enregistrée : " + error.message); return; }
  await loadInscriptions();
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}
