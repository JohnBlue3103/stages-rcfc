// Settings > API dans le dashboard Supabase (nouveau projet "stages-rcfc")
const SUPABASE_URL  = 'https://exhtzabawudjqfjqavvz.supabase.co';
const SUPABASE_ANON = 'sb_publishable_AICyMJPOoCVwdNhCyOBWdg_d8J6hAei';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// Compte gratuit sur https://www.emailjs.com
// Service > Service ID / Template > Template ID / Account > Public Key
const EMAILJS_PUBLIC_KEY  = 'COLLER_LA_PUBLIC_KEY_ICI';
const EMAILJS_SERVICE_ID  = 'COLLER_LE_SERVICE_ID_ICI';
const EMAILJS_TEMPLATE_ID = 'COLLER_LE_TEMPLATE_ID_ICI';

if (window.emailjs) emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });

// Coordonnées bancaires affichées lors de la pré-inscription (à compléter)
const VIREMENT_INFO = {
  beneficiaire: 'Ramonville Coteaux Football Club',
  iban: 'FR76 XXXX XXXX XXXX XXXX XXXX XXX',
  bic:  'XXXXXXXX'
};
