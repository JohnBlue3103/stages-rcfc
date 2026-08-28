let periodesCache = [];
let grilleTarifs = {}; // nb_jours -> prix

window.addEventListener('DOMContentLoaded', async () => {
  await chargerGrilleTarifs();
  await chargerPeriodes();
});

async function chargerGrilleTarifs() {
  const { data } = await sb.from('grille_tarifs').select('*').order('nb_jours');
  grilleTarifs = {};
  (data || []).forEach(t => { grilleTarifs[t.nb_jours] = Number(t.prix); });
}

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

function formatDateCourte(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

// Liste les jours de semaine (lundi-vendredi) entre deux dates incluses
function joursOuvresPeriode(dateDebut, dateFin) {
  const jours = [];
  let d = new Date(dateDebut + 'T00:00:00');
  const fin = new Date(dateFin + 'T00:00:00');
  while (d <= fin) {
    const jourSemaine = d.getDay(); // 0 = dimanche, 6 = samedi
    if (jourSemaine >= 1 && jourSemaine <= 5) {
      jours.push(d.toISOString().slice(0, 10));
    }
    d.setDate(d.getDate() + 1);
  }
  return jours;
}

function prixPourNbJours(nb) {
  if (grilleTarifs[nb] != null) return grilleTarifs[nb];
  // Sécurité si nb dépasse la grille (ne devrait pas arriver, max 5 jours)
  const max = Math.max(...Object.keys(grilleTarifs).map(Number));
  return grilleTarifs[max] || 0;
}

function renderCardPeriode(p) {
  const complet = p.places_max != null && p.places_prises >= p.places_max;
  const placesRestantes = p.places_max != null ? Math.max(0, p.places_max - p.places_prises) : null;
  const nbJoursMax = joursOuvresPeriode(p.date_debut, p.date_fin).length;
  const prixMin = prixPourNbJours(1);
  const prixMax = prixPourNbJours(nbJoursMax);

  return `
  <div class="periode-card">
    <h2>${p.nom}</h2>
    <div class="periode-dates">Du ${formatDateFr(p.date_debut)} au ${formatDateFr(p.date_fin)}</div>
    <div class="periode-meta">
      <div class="periode-tarif">${prixMin} € <span>à</span> ${prixMax} € <span>selon les jours choisis</span></div>
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

  const jours = joursOuvresPeriode(p.date_debut, p.date_fin);

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

    <label>Jours souhaités</label>
    <div class="jours-checklist" id="jours-checklist">
      ${jours.map(j => `
        <label class="jour-check">
          <input type="checkbox" class="f-jour" value="${j}" onchange="recalculerMontant()" checked/>
          ${formatDateCourte(j)}
        </label>`).join('')}
    </div>

    <label class="tarif-reduit-row">
      <input type="checkbox" id="f-tarif-reduit" onchange="recalculerMontant()"/>
      Tarif réduit -20% (2ᵉ enfant du foyer et suivants)
    </label>

    <div class="montant-box" id="montant-box"></div>

    <div class="info-collation">
      🍎 Collation offerte par le club matin et après-midi. Le repas du midi est à apporter
      (réfrigérateur et micro-ondes disponibles sur place).
    </div>

    <button class="btn-gold" style="margin-top:14px;" onclick="validerInscription('${p.id}')">Valider ma pré-inscription</button>
  `;

  document.getElementById('modal-inscription').classList.add('show');
  recalculerMontant();
}

function joursSelectionnes() {
  return Array.from(document.querySelectorAll('.f-jour:checked')).map(el => el.value);
}

function recalculerMontant() {
  const nb = joursSelectionnes().length;
  const reduit = document.getElementById('f-tarif-reduit')?.checked;
  const box = document.getElementById('montant-box');
  if (!box) return;

  if (nb === 0) {
    box.innerHTML = `<span style="color:#fc8181;">Sélectionnez au moins un jour</span>`;
    return;
  }

  const prixBase = prixPourNbJours(nb);
  const montant = reduit ? Math.round(prixBase * 0.8 * 100) / 100 : prixBase;

  box.innerHTML = `${nb} jour${nb > 1 ? 's' : ''} sélectionné${nb > 1 ? 's' : ''} — Montant à régler :
    <strong>${montant} €</strong>${reduit ? ' <span style="color:#8fa8c8;">(tarif réduit -20% appliqué)</span>' : ''}`;
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
  const jours     = joursSelectionnes();
  const reduit    = document.getElementById('f-tarif-reduit').checked;

  if (!prenom || !nom || !email) return showToast('Merci de remplir au moins le nom, prénom et email');
  if (!jours.length) return showToast('Merci de sélectionner au moins un jour');

  const prixBase = prixPourNbJours(jours.length);
  const montant = reduit ? Math.round(prixBase * 0.8 * 100) / 100 : prixBase;

  const { error } = await sb.from('inscriptions').insert({
    periode_id: periodeId,
    prenom, nom,
    date_naissance: naissance,
    nom_parent: parent,
    email, telephone,
    jours_selectionnes: jours,
    tarif_reduit: reduit,
    montant
  });

  if (error) return showToast('Erreur : ' + error.message);

  const p = periodesCache.find(x => x.id === periodeId);
  afficherConfirmation(p, nom, prenom, jours, montant);
  chargerPeriodes(); // rafraîchit les places restantes
}

function afficherConfirmation(p, nom, prenom, jours, montant) {
  document.getElementById('modal-form-content').innerHTML = `
    <div class="confirmation">
      <div class="check">✅</div>
      <h3>Pré-inscription enregistrée</h3>
      <p>${prenom} ${nom} est pré-inscrit(e) au stage <strong style="color:#fff;">${p.nom}</strong>
      (${jours.length} jour${jours.length > 1 ? 's' : ''} : ${jours.map(formatDateCourte).join(', ')}).
      Pour valider définitivement l'inscription, merci d'effectuer un virement bancaire avec les coordonnées ci-dessous.
      L'adhésion sera confirmée par email dès réception du paiement.</p>
      <div class="virement-box">
        <div><span>Bénéficiaire</span> <strong>${VIREMENT_INFO.beneficiaire}</strong></div>
        <div><span>IBAN</span> <strong>${VIREMENT_INFO.iban}</strong></div>
        <div><span>BIC</span> <strong>${VIREMENT_INFO.bic}</strong></div>
        <div><span>Montant</span> <strong>${montant} €</strong></div>
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
