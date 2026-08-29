let periodesCache = [];
let grilleTarifs = {}; // nb_jours -> prix
let semainesModalCache = {}; // id -> semaine, pour la modale d'inscription ouverte

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

  const avecSemaines = await Promise.all(periodes.map(async p => {
    const { data: semaines } = await sb.from('semaines').select('*').eq('periode_id', p.id).order('ordre');
    return { ...p, semaines: semaines || [] };
  }));

  periodesCache = avecSemaines;
  grid.innerHTML = avecSemaines.map(renderCardPeriode).join('');
}

function formatDateFr(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateCourte(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

// Le virement doit être fait au moins 3 semaines (21 jours) avant le premier jour choisi
function dateLimitePaiement(premierJour) {
  const d = new Date(premierJour + 'T00:00:00');
  d.setDate(d.getDate() - 21);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
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
  const max = Math.max(...Object.keys(grilleTarifs).map(Number));
  return grilleTarifs[max] || 0;
}

function renderCardPeriode(p) {
  const semaines = p.semaines || [];
  const debut = semaines.length ? semaines.reduce((min, s) => s.date_debut < min ? s.date_debut : min, semaines[0].date_debut) : null;
  const fin   = semaines.length ? semaines.reduce((max, s) => s.date_fin > max ? s.date_fin : max, semaines[0].date_fin) : null;

  return `
  <div class="periode-card">
    <h2>${p.nom}</h2>
    ${p.lieu ? `<div class="periode-lieu">📍 ${p.lieu === 'Ramonville' ? 'Stade Honneur Ramonville' : p.lieu}</div>` : ''}
    ${debut
      ? `<div class="periode-dates">Du ${formatDateFr(debut)} au ${formatDateFr(fin)}${semaines.length > 1 ? ' — ' + semaines.length + ' semaines au choix' : ''}</div>`
      : ''}
    <button class="btn-gold" ${semaines.length ? '' : 'disabled'} onclick="ouvrirInscription('${p.id}')">
      ${semaines.length ? "Je m'inscris" : 'Bientôt disponible'}
    </button>
  </div>`;
}

function ouvrirInscription(periodeId) {
  const p = periodesCache.find(x => x.id === periodeId);
  if (!p || !p.semaines?.length) return;

  semainesModalCache = {};
  p.semaines.forEach(s => { semainesModalCache[s.id] = s; });

  document.getElementById('modal-form-content').innerHTML = `
    <h3>Pré-inscription</h3>
    <div class="sub">${p.nom}</div>

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

    <label>Semaine(s) souhaitée(s)</label>
    <div id="semaines-checklist">
      ${p.semaines.map(s => `
        <div class="semaine-block">
          <label class="semaine-check">
            <input type="checkbox" class="f-semaine" value="${s.id}" onchange="toggleSemaine('${s.id}')"/>
            <strong>${s.nom}</strong> — du ${formatDateFr(s.date_debut)} au ${formatDateFr(s.date_fin)}
          </label>
          <div class="jours-checklist" id="jours-semaine-${s.id}" style="display:none;"></div>
        </div>
      `).join('')}
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

    <label class="consent-row">
      <input type="checkbox" id="f-autorisation-sortie"/>
      J'autorise mon enfant à se déplacer en compagnie de l'éducateur en dehors du stade
      (cinéma, médiathèque, Centre Culturel Kiwi...)
    </label>

    ${p.piscine ? `
    <label class="consent-row">
      <input type="checkbox" id="f-sait-nager"/>
      Je confirme que mon enfant sait nager (une séance de natation est prévue durant ce stage)
    </label>` : ''}

    <button class="btn-gold" style="margin-top:14px;" onclick="validerInscription('${p.id}')">Valider ma pré-inscription</button>
  `;

  document.getElementById('modal-inscription').classList.add('show');
  recalculerMontant();
}

function toggleSemaine(semaineId) {
  const cb = document.querySelector(`.f-semaine[value="${semaineId}"]`);
  const container = document.getElementById('jours-semaine-' + semaineId);

  if (cb.checked) {
    const semaine = semainesModalCache[semaineId];
    const jours = joursOuvresPeriode(semaine.date_debut, semaine.date_fin);
    container.innerHTML = jours.map(j => `
      <label class="jour-check">
        <input type="checkbox" class="f-jour" data-semaine="${semaineId}" value="${j}" onchange="recalculerMontant()" checked/>
        ${formatDateCourte(j)}
      </label>`).join('');
    container.style.display = 'grid';
  } else {
    container.innerHTML = '';
    container.style.display = 'none';
  }
  recalculerMontant();
}

function joursSelectionnes() {
  return Array.from(document.querySelectorAll('.f-jour:checked')).map(el => el.value);
}

// Calcule le montant total : grille dégressive appliquée semaine par semaine, puis additionnée
function calculerMontantBase() {
  let total = 0;
  document.querySelectorAll('.f-semaine:checked').forEach(cb => {
    const nb = document.querySelectorAll(`.f-jour[data-semaine="${cb.value}"]:checked`).length;
    if (nb > 0) total += prixPourNbJours(nb);
  });
  return Math.round(total * 100) / 100;
}

function recalculerMontant() {
  const semainesChecked = document.querySelectorAll('.f-semaine:checked');
  const reduit = document.getElementById('f-tarif-reduit')?.checked;
  const box = document.getElementById('montant-box');
  if (!box) return;

  if (!semainesChecked.length) {
    box.innerHTML = `<span style="color:#fc8181;">Sélectionnez au moins une semaine</span>`;
    return;
  }
  if (!joursSelectionnes().length) {
    box.innerHTML = `<span style="color:#fc8181;">Sélectionnez au moins un jour</span>`;
    return;
  }

  const prixBase = calculerMontantBase();
  const montant = reduit ? Math.round(prixBase * 0.8 * 100) / 100 : prixBase;

  box.innerHTML = `Montant à régler : <strong>${montant} €</strong>${reduit ? ' <span style="color:#8fa8c8;">(tarif réduit -20% appliqué)</span>' : ''}`;
}

function fermerModal() {
  document.getElementById('modal-inscription').classList.remove('show');
}

async function validerInscription(periodeId) {
  const p = periodesCache.find(x => x.id === periodeId);

  const prenom      = document.getElementById('f-prenom').value.trim();
  const nom         = document.getElementById('f-nom').value.trim();
  const naissance   = document.getElementById('f-naissance').value || null;
  const parent      = document.getElementById('f-parent').value.trim() || null;
  const email       = document.getElementById('f-email').value.trim();
  const telephone   = document.getElementById('f-telephone').value.trim() || null;
  const jours       = joursSelectionnes();
  const reduit      = document.getElementById('f-tarif-reduit').checked;
  const sortie      = document.getElementById('f-autorisation-sortie').checked;
  const saitNagerEl = document.getElementById('f-sait-nager');
  const saitNager   = saitNagerEl ? saitNagerEl.checked : null;

  if (!prenom || !nom || !email) return showToast('Merci de remplir au moins le nom, prénom et email');
  if (!document.querySelectorAll('.f-semaine:checked').length) return showToast('Merci de sélectionner au moins une semaine');
  if (!jours.length) return showToast('Merci de sélectionner au moins un jour');
  if (!sortie) return showToast("Merci de cocher l'autorisation de sortie pour valider l'inscription");
  if (saitNagerEl && !saitNager) return showToast('Merci de confirmer que votre enfant sait nager pour ce stage');

  const prixBase = calculerMontantBase();
  const montant = reduit ? Math.round(prixBase * 0.8 * 100) / 100 : prixBase;

  const { error } = await sb.from('inscriptions').insert({
    periode_id: periodeId,
    prenom, nom,
    date_naissance: naissance,
    nom_parent: parent,
    email, telephone,
    jours_selectionnes: jours,
    tarif_reduit: reduit,
    montant,
    autorisation_sortie: sortie,
    sait_nager: saitNager
  });

  if (error) return showToast('Erreur : ' + error.message);

  afficherConfirmation(p, nom, prenom, jours, montant);
  envoyerEmailPreinscription({ email, nom, prenom, jours, montant }, p);
  chargerPeriodes();
}

function referenceVirement(nom, prenom, periodeNom) {
  return nom.toUpperCase() + ' ' + prenom + ' - ' + periodeNom;
}

function afficherConfirmation(p, nom, prenom, jours, montant) {
  const premierJour = jours.slice().sort()[0];
  const dateLimite = dateLimitePaiement(premierJour);
  const reference = referenceVirement(nom, prenom, p.nom);
  document.getElementById('modal-form-content').innerHTML = `
    <div class="confirmation">
      <div class="check">✅</div>
      <h3>Pré-inscription enregistrée</h3>
      <p><strong style="color:#fc8181;">Attention : ceci est une PRÉ-inscription, elle ne vaut pas inscription définitive.</strong>
      ${prenom} ${nom} est pré-inscrit(e) au stage <strong style="color:#fff;">${p.nom}</strong>
      (${jours.length} jour${jours.length > 1 ? 's' : ''} : ${jours.slice().sort().map(formatDateCourte).join(', ')}).
      L'inscription ne sera confirmée qu'à réception du virement, <strong style="color:#fff;">au plus tard le ${dateLimite}</strong>
      (3 semaines avant le début du stage). Une fois votre virement effectué, vous recevrez un email de confirmation
      dès que le trésorier aura pointé la réception du paiement.</p>
      <div class="virement-box">
        <div><span>Bénéficiaire</span> <strong>${VIREMENT_INFO.beneficiaire}</strong></div>
        <div><span>IBAN</span> <strong>${VIREMENT_INFO.iban}</strong></div>
        <div><span>BIC</span> <strong>${VIREMENT_INFO.bic}</strong></div>
        <div><span>Montant</span> <strong>${montant} €</strong></div>
        <div><span>Référence</span> <strong>${reference}</strong></div>
        <div><span>Date limite</span> <strong style="color:#fc8181;">${dateLimite}</strong></div>
      </div>
      <div class="info-collation">
        💶 Vous pouvez aussi régler en espèces ou par chèque à la permanence du club,
        le <strong style="color:#fff;">mercredi de 17h à 19h30</strong>.
      </div>
      <button class="btn-gold" onclick="fermerModal()">Fermer</button>
    </div>
  `;
}

async function envoyerEmailPreinscription(inscription, periode) {
  const premierJour = inscription.jours.slice().sort()[0];
  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_PREINSCRIPTION_ID, {
      to_email: inscription.email,
      to_name: inscription.prenom + ' ' + inscription.nom,
      periode_nom: periode.nom,
      jours: inscription.jours.slice().sort().map(formatDateCourte).join(', '),
      montant: inscription.montant,
      date_limite: dateLimitePaiement(premierJour),
      iban: VIREMENT_INFO.iban,
      bic: VIREMENT_INFO.bic,
      beneficiaire: VIREMENT_INFO.beneficiaire,
      reference: referenceVirement(inscription.nom, inscription.prenom, periode.nom),
    });
  } catch (e) {
    console.error('Erreur envoi email pré-inscription :', e);
    // Silencieux pour l'utilisateur : la pré-inscription est déjà enregistrée en base, l'email est un bonus
  }
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}
