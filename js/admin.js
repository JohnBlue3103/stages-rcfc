let periodesCache = [];
let grilleTarifsCache = [];

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
        <div class="periode-row-sub">Du ${formatDateFr(p.date_debut)} au ${formatDateFr(p.date_fin)}${p.places_max ? ' — ' + p.places_max + ' places' : ''}${p.actif ? '' : ' — masquée'}</div>
      </div>
      <div class="periode-row-actions">
        <button class="btn-sm-grey" onclick="editPeriode('${p.id}')">✎ Modifier</button>
        <button class="btn-sm-red" onclick="deletePeriode('${p.id}')">🗑</button>
      </div>
    </div>
  `).join('');
}

function renderPeriodesSelect() {
  const sel = document.getElementById('inscriptions-periode-select');
  const previous = sel.value;
  sel.innerHTML = '<option value="">— Choisir une période —</option>' +
    periodesCache.map(p => `<option value="${p.id}">${p.nom}</option>`).join('');
  if (previous) sel.value = previous;
}

function editPeriode(id) {
  const p = periodesCache.find(x => x.id === id);
  if (!p) return;
  document.getElementById('periode-form-title').textContent = 'Modifier la période';
  document.getElementById('p-id').value = p.id;
  document.getElementById('p-nom').value = p.nom;
  document.getElementById('p-date-debut').value = p.date_debut;
  document.getElementById('p-date-fin').value = p.date_fin;
  document.getElementById('p-places').value = p.places_max ?? '';
  document.getElementById('p-ordre').value = p.ordre ?? 0;
  document.getElementById('p-actif').checked = p.actif;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetFormPeriode() {
  document.getElementById('periode-form-title').textContent = 'Nouvelle période';
  document.getElementById('p-id').value = '';
  document.getElementById('p-nom').value = '';
  document.getElementById('p-date-debut').value = '';
  document.getElementById('p-date-fin').value = '';
  document.getElementById('p-places').value = '';
  document.getElementById('p-ordre').value = 0;
  document.getElementById('p-actif').checked = true;
}

async function savePeriode() {
  const id         = document.getElementById('p-id').value || null;
  const nom        = document.getElementById('p-nom').value.trim();
  const dateDebut  = document.getElementById('p-date-debut').value;
  const dateFin    = document.getElementById('p-date-fin').value;
  const places     = document.getElementById('p-places').value ? Number(document.getElementById('p-places').value) : null;
  const ordre      = Number(document.getElementById('p-ordre').value) || 0;
  const actif      = document.getElementById('p-actif').checked;

  if (!nom || !dateDebut || !dateFin) return showToast('Merci de remplir au moins le nom et les dates');

  const { error } = await sb.rpc('admin_upsert_periode', {
    p_id: id, p_nom: nom, p_date_debut: dateDebut, p_date_fin: dateFin,
    p_places_max: places, p_ordre: ordre, p_actif: actif
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

  if (!periodeId) {
    attenteEl.innerHTML = '<div class="empty-state"><p>Sélectionnez une période</p></div>';
    payesEl.innerHTML   = '<div class="empty-state"><p>—</p></div>';
    return;
  }

  const { data, error } = await sb.rpc('admin_list_inscriptions', { p_periode_id: periodeId });
  if (error) { showToast('Erreur : ' + error.message); return; }

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

function renderInscritRow(i, periode) {
  const nbJours = i.jours_selectionnes?.length || 0;
  const joursLabel = nbJours
    ? nbJours + ' jour' + (nbJours > 1 ? 's' : '') + ' (' + i.jours_selectionnes.map(j => new Date(j + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })).join(', ') + ')'
    : '—';
  return `
    <div class="inscrit-row ${i.paye ? 'paye' : ''}" id="inscrit-${i.id}">
      <div>
        <div class="inscrit-nom">${i.prenom} ${i.nom}</div>
        <div class="inscrit-meta">${i.email}${i.telephone ? ' · ' + i.telephone : ''}${i.nom_parent ? ' · Parent : ' + i.nom_parent : ''}</div>
        <div class="inscrit-meta">${joursLabel}${i.tarif_reduit ? ' · tarif réduit -20%' : ''} · <strong style="color:#fff;">${i.montant != null ? i.montant + ' €' : '—'}</strong></div>
        <div class="inscrit-meta">Pré-inscrit le ${new Date(i.date_inscription).toLocaleDateString('fr-FR')}</div>
      </div>
      <div class="inscrit-actions">
        ${i.paye
          ? `<span class="badge-paye">✔ Payé</span>`
          : `<span class="badge-attente">En attente</span>
             <button class="btn-sm-green" onclick="marquerPaye('${i.id}', '${periode?.nom.replace(/'/g, "\\'")}')">Cet adhérent a payé</button>`}
        <button class="btn-sm-red" onclick="supprimerInscription('${i.id}')">🗑 Supprimer</button>
      </div>
    </div>
  `;
}

async function marquerPaye(inscriptionId, periodeNom) {
  const { data, error } = await sb.rpc('admin_marquer_paye', { p_id: inscriptionId, p_paye: true });
  if (error) { showToast('Erreur : ' + error.message); return; }

  showToast('Adhérent marqué comme payé ✅');
  await envoyerEmailConfirmation(data, periodeNom);
  await loadInscriptions();
}

async function supprimerInscription(inscriptionId) {
  if (!confirm('Supprimer définitivement cet adhérent ?')) return;
  const { error } = await sb.rpc('admin_delete_inscription', { p_id: inscriptionId });
  if (error) return showToast('Erreur : ' + error.message);
  showToast('Adhérent supprimé');
  await loadInscriptions();
}

async function envoyerEmailConfirmation(inscription, periodeNom) {
  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_PAIEMENT_ID, {
      to_email: inscription.email,
      to_name: inscription.prenom + ' ' + inscription.nom,
      periode_nom: periodeNom || '',
    });
  } catch (e) {
    showToast("Paiement enregistré, mais l'envoi du mail a échoué : vérifiez la config EmailJS");
  }
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}
