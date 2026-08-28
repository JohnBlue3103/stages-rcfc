let periodesCache = [];

window.addEventListener('DOMContentLoaded', chargerPeriodes);

async function chargerPeriodes() {
  const { data: periodes, error } = await sb
    .from('periodes')
    .select('*')
    .eq('actif', true)
    .order('ordre');

  const grid = document.getElementById('periodes-grid');

  if (error || !periodes?.length) {
    grid.innerHTML = '<div class="empty-state" style="color:#8fa8c8;grid-column:1/-1;"><p>Aucune période de stage disponible pour le moment.</p></div>';
    return;
  }

  // Récupère le nombre de places prises pour chaque période
  const avecPlaces = await Promise.all(periodes.map(async p => {
    const { data: prises } = await sb.rpc('places_prises', { p_periode_id: p.id });
    return { ...p, places_prises: prises || 0 };
  }));

  periodesCache = avecPlaces;
  grid.innerHTML = avecPlaces.map(renderCardPeriode).join('');
}

function formatDateFr(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function renderCardPeriode(p) {
  const complet = p.places_max != null && p.places_prises >= p.places_max;
  const placesRestantes = p.places_max != null ? Math.max(0, p.places_max - p.places_prises) : null;

  return `
  <div class="periode-card">
    <h2>${p.nom}</h2>
    <div class="periode-dates">Du ${formatDateFr(p.date_debut)} au ${formatDateFr(p.date_fin)}</div>
    <div class="periode-meta">
      <div class="periode-tarif">${p.tarif != null ? p.tarif + ' €' : '—'} <span>/ semaine</span></div>
      ${placesRestantes != null
        ? `<div class="periode-places ${complet ? 'complet' : ''}">${complet ? 'Complet' : placesRestantes + ' places restantes'}</div>`
        : ''}
    </div>
    <button class="btn-gold" ${complet ? 'disabled' : ''} onclick="ouvrirInscription('${p.id}')">
      ${complet ? 'Complet' : "Je m'inscris"}
    </button>
  </div>`;
}

function ouvrirInscription(periodeId) {
  const p = periodesCache.find(x => x.id === periodeId);
  if (!p) return;

  document.getElementById('modal-form-content').innerHTML = `
    <h3>Pré-inscription</h3>
    <div class="sub">${p.nom} — du ${formatDateFr(p.date_debut)} au ${formatDateFr(p.date_fin)}</div>

    <label>Prénom de l'adhérent</label>
    <input type="text" id="f-prenom" placeholder="Prénom"/>
    <label>Nom de l'adhérent</label>
    <input type="text" id="f-nom" placeholder="Nom"/>
    <label>Date de naissance</label>
    <input type="date" id="f-naissance"/>
    <label>Nom du parent (si mineur)</label>
    <input type="text" id="f-parent" placeholder="Facultatif"/>
    <label>Email de contact</label>
    <input type="email" id="f-email" placeholder="email@exemple.fr"/>
    <label>Téléphone</label>
    <input type="tel" id="f-telephone" placeholder="06 12 34 56 78"/>

    <button class="btn-gold" style="margin-top:14px;" onclick="validerInscription('${p.id}')">Valider ma pré-inscription</button>
  `;

  document.getElementById('modal-inscription').classList.add('show');
}

function fermerModal() {
  document.getElementById('modal-inscription').classList.remove('show');
}

async function validerInscription(periodeId) {
  const prenom    = document.getElementById('f-prenom').value.trim();
  const nom       = document.getElementById('f-nom').value.trim();
  const naissance = document.getElementById('f-naissance').value || null;
  const parent    = document.getElementById('f-parent').value.trim() || null;
  const email     = document.getElementById('f-email').value.trim();
  const telephone = document.getElementById('f-telephone').value.trim() || null;

  if (!prenom || !nom || !email) return showToast('Merci de remplir au moins le nom, prénom et email');

  const { error } = await sb.from('inscriptions').insert({
    periode_id: periodeId,
    prenom, nom,
    date_naissance: naissance,
    nom_parent: parent,
    email, telephone
  });

  if (error) return showToast('Erreur : ' + error.message);

  const p = periodesCache.find(x => x.id === periodeId);
  afficherConfirmation(p, nom, prenom);
  chargerPeriodes(); // rafraîchit les places restantes
}

function afficherConfirmation(p, nom, prenom) {
  document.getElementById('modal-form-content').innerHTML = `
    <div class="confirmation">
      <div class="check">✅</div>
      <h3>Pré-inscription enregistrée</h3>
      <p>${prenom} ${nom} est pré-inscrit(e) au stage <strong style="color:#fff;">${p.nom}</strong>.
      Pour valider définitivement l'inscription, merci d'effectuer un virement bancaire avec les coordonnées ci-dessous.
      L'adhésion sera confirmée par email dès réception du paiement.</p>
      <div class="virement-box">
        <div><span>Bénéficiaire</span> <strong>${VIREMENT_INFO.beneficiaire}</strong></div>
        <div><span>IBAN</span> <strong>${VIREMENT_INFO.iban}</strong></div>
        <div><span>BIC</span> <strong>${VIREMENT_INFO.bic}</strong></div>
        <div><span>Montant</span> <strong>${p.tarif != null ? p.tarif + ' €' : '—'}</strong></div>
        <div><span>Référence</span> <strong>${nom.toUpperCase()} ${prenom}</strong></div>
      </div>
      <button class="btn-gold" onclick="fermerModal()">Fermer</button>
    </div>
  `;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}
