// Étagère — navigation (#/…), cadre (en-tête, barre du bas), connexion, menu, bandeau cookies.
import { T } from './textes.js';
import { api, el, icone, message, NonConnecte } from './commun.js';
import { vueBibliotheque } from './vues/bibliotheque.js';
import { vueSerie } from './vues/serie.js';
import { vueAVenir } from './vues/a-venir.js';
import { vueAjouter } from './vues/ajouter.js';
import { vuePile } from './vues/pile.js';
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
    el('div.scanner-zone', {}, el('button.scanner-bouton', { 'aria-label': T.noterAchat, onclick: () => ouvrirScanner(afficher) }, icone('scan')), el('span', { texte: T.ajouterTome })),
    lienBarre('#/ajouter', 'plus', T.ajouter),
    el('a', { href: '#', onclick: (e) => { e.preventDefault(); ouvrirMenu(); } }, icone('menu'), T.menu));
  const main = el('main', { id: 'contenu', tabindex: '-1' }, contenu);
  app.replaceChildren(entete, main, barre);
  bandeau();
}

async function afficher() {
  try {
    if (!session) session = await api('session');
    const h = location.hash || '#/';
    const [re, vue] = ROUTES.find(([r]) => r.test(h));
    const contenu = await vue(h.match(re));
    cadre(contenu);
    window.scrollTo(0, 0);
    if (session.libre) rappelSauvegarde();
  } catch (e) {
    if (e instanceof NonConnecte) return ecranConnexion();
    cadre(el('p.vide', {}, el('strong', { texte: T.erreurReseau }), e.message));
  }
}

function ecranConnexion() {
  session = null;
  const err = el('p.erreur', { role: 'alert' });
  const champ = el('input', { type: 'password', id: 'mdp', autocomplete: 'current-password', required: true });
  const form = el('form', {
    onsubmit: async (e) => {
      e.preventDefault(); err.textContent = '';
      try { await api('connexion', { method: 'POST', corps: { mot_de_passe: champ.value } }); afficher(); }
      catch (x) { err.textContent = x.message; champ.select(); }
    },
  },
  el('h1', {}, 'Étag', el('span', { texte: 'è' }), 're'),
  el('p.meta', { texte: T.slogan }),
  el('label.champ', { for: 'mdp' }, el('span', { texte: T.motDePasse }), champ),
  err, el('button.bouton.or', { type: 'submit', texte: T.entrer }), piedLegal());
  app.replaceChildren(el('main.connexion', { id: 'contenu' }, form));
  champ.focus();
}

export function piedLegal() {
  return el('p.pied', {}, ...T.legal.flatMap(([t, h], i) => [i ? ' · ' : '', el('a', { href: h, texte: t })]));
}

function ouvrirMenu() {
  const fermer = () => { voile.remove(); feuille.remove(); };
  const voile = el('div.voile', { onclick: fermer });
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
  const feuille = el('div.feuille', { role: 'dialog', 'aria-label': T.menu },
    notif,
    libre ? [boutonSauvegarder('bouton.discret', fermer), boutonRestaurer(() => { fermer(); afficher(); }), boutonAutreAppareil(fermer)] : [
      el('button.bouton.discret', { texte: T.automate, onclick: async () => {
        try { montrer(await api('automate', { method: 'POST' })); message(T.automateDemande); } catch (x) { message(x.message); }
      } }),
      etatAuto],
    el('a.bouton.discret', { href: '#/pile', texte: T.pile, onclick: fermer }),
    el('button.bouton.discret', { texte: T.verifier, onclick: async () => {
      fermer(); message('…');
      if (libre) { await api('libre/synchroniser', { method: 'POST' }); message(T.aJour); afficher(); return; }
      const r = await api('verifier-sorties', { method: 'POST' }); message(`${r.notifications} nouvelle(s) annonce(s)`); afficher();
    } }),
    el('button.bouton.discret', { texte: T.completerTout, onclick: async () => {
      fermer(); message('Recherche des infos…');
      try {
        const r = await completerFiches((p) => message(`${p.restant} tome(s) restant(s)…`));
        message(r.restant ? `${r.total} complété(s), la suite plus tard (quota Google)` : `${r.total} tome(s) complété(s)`); afficher();
      } catch (x) { message(x.message); }
    } }),
    libre ? '' : el('a.bouton.discret', { href: '/api/export', download: 'etagere.json', texte: T.exporter }),
    libre ? '' : el('button.bouton.danger', { texte: T.deconnexion, onclick: async () => { await api('deconnexion', { method: 'POST' }); fermer(); ecranConnexion(); } }),
    piedLegal());
  document.body.append(voile, feuille);
  feuille.querySelector('button').focus();
  feuille.addEventListener('keydown', (e) => e.key === 'Escape' && fermer());
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
if (LIBRE) demarrerLibre().then((ok) => ok && afficher());
else {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  afficher();
}
