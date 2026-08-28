// Settings > API dans le dashboard Supabase (nouveau projet "stages-rcfc")
const SUPABASE_URL  = 'https://exhtzabawudjqfjqavvz.supabase.co';
const SUPABASE_ANON = 'sb_publishable_AICyMJPOoCVwdNhCyOBWdg_d8J6hAei';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// Compte gratuit sur https://www.emailjs.com
// Service > Service ID / Account > Public Key
const EMAILJS_PUBLIC_KEY  = 'COLLER_LA_PUBLIC_KEY_ICI';
const EMAILJS_SERVICE_ID  = 'COLLER_LE_SERVICE_ID_ICI';

// Deux templates différents (Email Templates > + Create New Template) :
// 1) envoyé tout de suite après la pré-inscription (rappel : ce n'est pas encore définitif)
const EMAILJS_TEMPLATE_PREINSCRIPTION_ID = 'COLLER_LE_TEMPLATE_ID_PREINSCRIPTION_ICI';
// 2) envoyé quand l'admin clique "Cet adhérent a payé" (confirmation définitive)
const EMAILJS_TEMPLATE_PAIEMENT_ID = 'COLLER_LE_TEMPLATE_ID_PAIEMENT_ICI';

if (window.emailjs) emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });

// Coordonnées bancaires affichées lors de la pré-inscription (à compléter)
const VIREMENT_INFO = {
  beneficiaire: 'Ramonville Coteaux Football Club',
  iban: 'FR76 XXXX XXXX XXXX XXXX XXXX XXX',
  bic:  'XXXXXXXX'
};
