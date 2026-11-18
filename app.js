// Étagère — navigation (#/…), cadre (en-tête, barre du bas), connexion, menu, bandeau cookies.
import { T } from './textes.js';
import { api, el, icone, message, erreur, ouvrirFeuille, NonConnecte, ErreurReseau } from './commun.js';
import { vueBibliotheque } from './vues/bibliotheque.js';
import { vueSerie } from './vues/serie.js';
import { vueAVenir } from './vues/a-venir.js';
import { vueAjouter } from './vues/ajouter.js';
import { vuePile } from './vues/pile.js';
import { vuePrets } from './vues/prets.js';
import { vueBilan } from './vues/bilan.js';
import { ouvrirScanner } from './scan.js';
import { activerNotifications } from './notifications.js';
import { completerFiches } from './vues/serie.js';
import { boutonSauvegarder, boutonRestaurer, rappelSauvegarde, boutonAutreAppareil, vueVoir } from './sauvegarde.js';

// Version libre (04/11) : la page est marquée data-libre par libre/construire.mjs ; le service worker fait le serveur.
const LIBRE = document.documentElement.hasAttribute('data-libre');

const app = document.getElementById('app');
let session = null;

const ROUTES = [
  [/^#\/serie\/(\d+)$/, (m) => vueSerie(Number(m[1]))],
  [/^#\/a-venir$/, () => vueAVenir()],
  [/^#\/ajouter$/, () => vueAjouter()],
  [/^#\/pile$/, () => vuePile()],
  [/^#\/prets$/, () => vuePrets()],
  [/^#\/bilan$/, () => vueBilan()],
  [/^#\/voir\/([A-Za-z0-9_-]+)$/, (m) => vueVoir(m[1], () => { history.replaceState(null, '', '#/'); afficher(); })],
  [/^/, () => vueBibliotheque()],
];

function lienBarre(href, nom, texte) {
  const actif = (location.hash || '#/') === href || (href === '#/' && /^#\/serie/.test(location.hash));
  return el('a', { href, 'aria-current': actif ? 'page' : null }, icone(nom), texte);
}

function cadre(contenu) {
  const entete = el('header.entete', {}, el('div.marque', {},
    el('h1', {}, el('a.titre-accueil', { href: '#/', 'aria-label': 'Étagère, retour à la bibliothèque' }, 'Étag', el('span', { texte: 'è' }), 're')),
    el('button.menu-bouton', { 'aria-label': T.menu, onclick: ouvrirMenu }, icone('menu'))));
  const barre = el('nav.barre', { 'aria-label': 'Navigation' },
    lienBarre('#/', 'livres', T.bibliotheque),
    lienBarre('#/a-venir', 'calendrier', T.aVenir),
    el('div.scanner-zone', {}, el('button.scanner-bouton', { 'aria-label': T.scannerTome, onclick: () => ouvrirScanner(afficher) }, icone('scan')), el('span', { 'aria-hidden': 'true', texte: T.scanner })),
    lienBarre('#/ajouter', 'plus', T.ajouter),
    lienBarre('#/bilan', 'lecture', T.bilan));   // le menu est déjà dans l'en-tête : la 5e place de la barre sert à « Ma lecture »
  const main = el('main', { id: 'contenu', tabindex: '-1' }, session?.horsLigne ? el('p.hors-ligne', { role: 'status', texte: T.horsLigne }) : '', contenu);
  app.replaceChildren(entete, main, barre);
  bandeau();
}

async function afficher() {
  try {
    // (perso) hors ligne : /api/session ne répond pas → on continue avec les données en cache, en lecture seule (18/11)
    if (!session) session = await api('session').catch((x) => { if (x instanceof ErreurReseau) return { horsLigne: true }; throw x; });
    if (session.ok === false) throw new NonConnecte();
    const h = location.hash || '#/';
    const [re, vue] = ROUTES.find(([r]) => r.test(h));
    const contenu = await vue(h.match(re));
    cadre(contenu);
    window.scrollTo(0, 0);
    if (session.libre) rappelSauvegarde();
  } catch (e) {
    if (e instanceof NonConnecte) return ecranConnexion();
    cadre(el('div.vide', { role: 'alert' }, el('strong', { texte: e instanceof ErreurReseau ? T.erreurReseau : e.message || T.erreurReseau }),
      el('p', {}, el('button.bouton.or', { type: 'button', texte: T.reessayer, onclick: () => { if (session?.horsLigne) session = null; afficher(); } }))));
  }
}

function ecranConnexion() {
  session = null;
  const err = el('p.erreur', { role: 'alert' });
  const champ = el('input', { type: 'password', id: 'mdp', autocomplete: 'current-password', required: true });
  const voir = el('label.case', {}, el('input', { type: 'checkbox', onchange: (e) => { champ.type = e.target.checked ? 'text' : 'password'; } }), el('span', { texte: T.afficherMdp }));
  const form = el('form', {
    onsubmit: async (e) => {
      e.preventDefault(); err.textContent = '';
      try { await api('connexion', { method: 'POST', corps: { mot_de_passe: champ.value } }); afficher(); }
      catch (x) { err.textContent = x.message; champ.select(); }
    },
  },
  el('h1', {}, 'Étag', el('span', { texte: 'è' }), 're'),
  el('p.meta', { texte: T.slogan }),
  el('label.champ', { for: 'mdp' }, el('span', { texte: T.motDePasse }), champ), voir,
  err, el('button.bouton.or', { type: 'submit', texte: T.entrer }), piedLegal());
  app.replaceChildren(el('main.connexion', { id: 'contenu' }, form));
  champ.focus();
}

export function piedLegal() {
  return el('p.pied', {}, ...T.legal.flatMap(([t, h], i) => [i ? ' · ' : '', el('a', { href: h, texte: t })]));
}

function ouvrirMenu() {
  let menu;
  const fermer = () => menu.fermer();
  const notif = el('button.bouton.or', {
    onclick: async () => {
      // version libre : pas de serveur pour pousser, l'appli prévient quand elle s'ouvre ou se met à jour
      message(session?.libre ? ((await window.Notification?.requestPermission?.()) === 'granted' ? T.notifsActives : T.notifsRefusees) : await activerNotifications(session?.vapid));
      fermer();
    },
    texte: typeof Notification !== 'undefined' && Notification.permission === 'granted' ? T.notifsActives : T.notifsActiver,
  });
  const etatAuto = el('p.meta.etat-automate', { 'aria-live': 'polite' });
  const montrer = (a) => { etatAuto.textContent = texteAutomate(a); };
  if (!session?.libre) api('automate').then(montrer).catch(() => {});
  const libre = !!session?.libre;
  const demanderAutomate = async () => {
    try { montrer(await api('automate', { method: 'POST' })); message(T.automateDemande); } catch (x) { erreur(x, demanderAutomate); }
  };
  // 18/11 : erreur réseau = message clair + Réessayer (avant : rien ne se passait)
  const verifier = async () => {
    message('…');
    try {
      if (libre) { await api('libre/synchroniser', { method: 'POST' }); message(T.aJour); afficher(); return; }
      const r = await api('verifier-sorties', { method: 'POST' }); message(`${r.notifications} nouvelle(s) annonce(s)`); afficher();
    } catch (x) { erreur(x, verifier); }
  };
  const completerTout = async () => {
    message('Recherche des infos…');
    try {
      const r = await completerFiches((p) => message(`${p.restant} tome(s) restant(s)…`));
      message(r.restant ? `${r.total} complété(s), la suite plus tard (quota Google)` : `${r.total} tome(s) complété(s)`); afficher();
    } catch (x) { erreur(x, completerTout); }
  };
  menu = ouvrirFeuille({ titre: T.menu, classe: 'menu' },
    notif,
    libre ? [boutonSauvegarder('bouton.discret', fermer), boutonRestaurer(() => { fermer(); afficher(); }), boutonAutreAppareil(fermer)] : [
      el('button.bouton.discret', { texte: T.automate, onclick: demanderAutomate }),
      etatAuto],
    el('a.bouton.discret', { href: '#/pile', texte: T.pile, onclick: fermer }),
    el('a.bouton.discret', { href: '#/prets', texte: T.prets, onclick: fermer }),
    el('a.bouton.discret', { href: '#/bilan', texte: T.bilan, onclick: fermer }),
    el('button.bouton.discret', { texte: T.verifier, onclick: () => { fermer(); verifier(); } }),
    el('button.bouton.discret', { texte: T.completerTout, onclick: () => { fermer(); completerTout(); } }),
    libre ? '' : el('a.bouton.discret', { href: '/api/export', download: 'etagere.json', texte: T.exporter }),
    el('a.bouton.discret', { href: '/aide.html', texte: T.aide }),
    libre ? '' : el('button.bouton.danger', { texte: T.deconnexion, onclick: async () => {
      try { await api('deconnexion', { method: 'POST' }); } catch (x) { return erreur(x); }
      await window.caches?.delete('etagere-donnees').catch(() => {}); // (perso) plus aucune donnée lisible sur l'appareil après la déconnexion
      fermer(); ecranConnexion();
    } }),
    piedLegal());
}

// « Dernier passage : 4 nov. à 01:59 · 2 date(s), 10 couverture(s) »
const quand = (iso) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
function texteAutomate({ demande, dernier } = {}) {
  if (dernier?.debut && !dernier.fin) {
    return Date.now() - Date.parse(dernier.debut) < 3 * 3600e3 ? `Automate en cours depuis ${quand(dernier.debut)}…` : `Dernier passage interrompu (${quand(dernier.debut)}).`;
  }
  if (demande) return `Demande en attente du PC (envoyée le ${quand(demande)}).`;
  return dernier?.fin ? `Dernier passage : ${quand(dernier.fin)} · ${dernier.resume}` : 'Automate : passage chaque dimanche à 14 h.';
}

function bandeau() {
  let vu = false;
  try { vu = localStorage.getItem('etagere-bandeau') === '1'; } catch { /* stockage bloqué : on réaffiche */ }
  if (vu || document.querySelector('.bandeau')) return;
  const b = el('div.bandeau', { role: 'region', 'aria-label': 'Cookies' },
    el('span', { texte: T.bandeau }), el('a', { href: '/cookies.html', texte: T.enSavoirPlus }),
    el('button.bouton', { texte: T.compris, onclick: () => { try { localStorage.setItem('etagere-bandeau', '1'); } catch { /* rien */ } b.remove(); } }));
  document.body.append(b);
}

// Version libre : attendre que le service worker (le « serveur » du téléphone) contrôle la page avant le 1er appel.
async function demarrerLibre() {
  Object.assign(T, T.libre);
  if (!('serviceWorker' in navigator) || !window.indexedDB) {
    app.replaceChildren(el('p.vide', {}, el('strong', { texte: T.navigateurTropVieux })));
    return false;
  }
  await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  if (!navigator.serviceWorker.controller) {
    await Promise.race([new Promise((ok) => navigator.serviceWorker.addEventListener('controllerchange', ok, { once: true })), new Promise((ok) => setTimeout(ok, 3000))]);
    if (!navigator.serviceWorker.controller) { location.reload(); return false; } // rechargement forcé : la page n'est pas encore contrôlée
  }
  navigator.storage?.persist?.().catch(() => {}); // demande au navigateur de ne jamais effacer la bibliothèque
  return true;
}

window.addEventListener('hashchange', afficher);
// 18/11 : toute erreur oubliée par un bouton devient un message français (jamais « Failed to fetch »)
window.addEventListener('unhandledrejection', (e) => {
  if (e.reason instanceof NonConnecte) { e.preventDefault(); ecranConnexion(); return; }
  if (e.reason instanceof ErreurReseau || e.reason?.message) { e.preventDefault(); erreur(e.reason); }
});
window.addEventListener('online', () => { if (session?.horsLigne) { session = null; afficher(); } });
if (LIBRE) demarrerLibre().then((ok) => ok && afficher());
else {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  afficher();
}
