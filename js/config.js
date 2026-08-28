// Settings > API dans le dashboard Supabase (nouveau projet "stages-rcfc")
const SUPABASE_URL  = 'https://exhtzabawudjqfjqavvz.supabase.co';
const SUPABASE_ANON = 'sb_publishable_AICyMJPOoCVwdNhCyOBWdg_d8J6hAei';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// Compte gratuit sur https://www.emailjs.com
// Service > Service ID / Account > Public Key
const EMAILJS_PUBLIC_KEY  = 'zsXeBT7IMDn9y5Lf9';
const EMAILJS_SERVICE_ID  = 'service_crjm0lr';

// Deux templates différents (Email Templates > + Create New Template) :
// 1) envoyé tout de suite après la pré-inscription (rappel : ce n'est pas encore définitif)
const EMAILJS_TEMPLATE_PREINSCRIPTION_ID = 'template_vh3ebzi';
// 2) envoyé quand l'admin clique "Cet adhérent a payé" (confirmation définitive)
const EMAILJS_TEMPLATE_PAIEMENT_ID = 'template_bxxv59n';

if (window.emailjs) emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });

// Coordonnées bancaires affichées lors de la pré-inscription
const VIREMENT_INFO = {
  beneficiaire: 'ASSOC. UNION SPORTIVE',
  iban: 'FR76 1310 6005 0030 0458 6095 305',
  bic:  'AGRIFRPP831'
};
