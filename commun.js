// Outils partagés par les vues : appels à l'API, création d'éléments, teinte des séries, message bref.
import { T } from './textes.js';

export class NonConnecte extends Error {}
export class ErreurReseau extends Error {} // réseau coupé : jamais le « Failed to fetch » du navigateur à l'écran (18/11)

export async function api(chemin, { method = 'GET', corps } = {}) {
  let r;
  try {
    r = await fetch(`/api/${chemin}`, {
      method, credentials: 'same-origin',
      headers: corps ? { 'Content-Type': 'application/json' } : {},
      body: corps ? JSON.stringify(corps) : undefined,
    });
  } catch { throw new ErreurReseau(T.erreurReseau); }
  if (r.status === 401 && chemin !== 'connexion') throw new NonConnecte();
  const j = await r.json().catch(() => ({})); // page d'erreur HTML (serveur coupé derrière Caddy) : message français
  if (!r.ok) throw new Error(j.erreur || T.erreurReseau);
  return j;
}

// el('a.livre', { href: '#' }, enfant1, 'texte') ; les attributs on* deviennent des écouteurs.
export function el(sel, attrs = {}, ...enfants) {
  const [tag, ...classes] = sel.split('.');
  const n = document.createElement(tag || 'div');
  if (classes.length) n.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'texte') n.textContent = v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const e of enfants.flat()) if (e !== null && e !== undefined && e !== false) n.append(e);
  return n;
}

// Teinte stable par série (calculée depuis le titre), posée en variable CSS (CSSOM : permis par la CSP).
export function teinte(noeud, titre) {
  let h = 0;
  for (const c of String(titre)) h = (h * 31 + c.codePointAt(0)) % 360;
  noeud.style.setProperty('--teinte', String(h));
  return noeud;
}

// Recherche (18/11) : « echo » trouve « Écho », « oeil » trouve « Œil »
export const sansAccents = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/gi, 'oe').replace(/æ/gi, 'ae').toLowerCase();

let minuteur;
// action : { texte: 'Réessayer', faire } → bouton dans le message, qui reste alors 7 s au lieu de 2,6 s.
export function message(texte, action) {
  document.querySelector('.message')?.remove();
  const m = el('div.message', { role: 'status' }, el('span', { texte }),
    action ? el('button', { type: 'button', texte: action.texte, onclick: () => { m.remove(); action.faire(); } }) : '');
  document.body.append(m);
  clearTimeout(minuteur);
  minuteur = setTimeout(() => m.remove(), action ? 7000 : 2600);
}
export const erreur = (x, refaire) => message(x?.message || T.erreurReseau, refaire && { texte: T.reessayer, faire: refaire });

// Feuille du bas modale (menu, fiche d'un tome) : titre + bouton Fermer, aria-modal, focus gardé dedans puis rendu, Échap.
export function ouvrirFeuille({ titre, classe = '' }, ...enfants) {
  const avant = document.activeElement;
  const app = document.getElementById('app');
  const corps = el('div.feuille-corps', {}, ...enfants);
  const idTitre = `feuille-${Date.now()}`;
  const feuille = el(`div.feuille${classe ? `.${classe}` : ''}`, { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': idTitre },
    el('div.feuille-tete', {}, el('h2', { id: idTitre, texte: titre }),
      el('button.bouton.discret.fermer', { type: 'button', 'aria-label': T.fermer, onclick: () => fermer() }, icone('fermer'))),
    corps);
  const voile = el('div.voile', { onclick: () => fermer() });
  const fermer = () => { voile.remove(); feuille.remove(); app.inert = false; document.removeEventListener('keydown', touches); avant?.focus?.(); };
  const touches = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); fermer(); return; }
    if (e.key !== 'Tab') return;
    const l = [...feuille.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, summary')].filter((x) => x.getClientRects().length);
    if (!l.length) return;
    if (!feuille.contains(document.activeElement)) { e.preventDefault(); l[0].focus(); } else if (e.shiftKey && document.activeElement === l[0]) { e.preventDefault(); l.at(-1).focus(); } else if (!e.shiftKey && document.activeElement === l.at(-1)) { e.preventDefault(); l[0].focus(); }
  };
  document.addEventListener('keydown', touches);
  app.inert = true; // rien derrière ne prend le focus ni les touchers
  document.body.append(voile, feuille);
  (corps.querySelector('button, a[href], input, select') || feuille.querySelector('.fermer')).focus();
  return { feuille, corps, fermer };
}

const CHEMINS = {
  livres: 'M4 19V5a2 2 0 0 1 2-2h2v18H6a2 2 0 0 1-2-2Zm6 2V3h3v18h-3Zm5-.6 3.2-17 3 .6-3.2 17-3-.6Z',
  calendrier: 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm3 8h3v3H8z',
  plus: 'M12 5v14M5 12h14',
  scan: 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 8v8M10 8v8M13 8v8M16 8v8',
  menu: 'M4 7h16M4 12h16M4 17h16',
  retour: 'M15 5l-7 7 7 7',
  fermer: 'M6 6l12 12M18 6 6 18',
  lecture: 'M3 21h18M6 21v-7M12 21V5M18 21v-10',
};
export function icone(nom) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.8'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', CHEMINS[nom]); s.append(p);
  return s;
}

export const dateCourte = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

// Couverture d'une série : l'image servie par le Worker, sinon une couverture dessinée (titre en serif).
export function couverture(serie) {
  // 18/11 (« Reliure ») : dos à nerfs à gauche, qui porte le type écrit à la verticale
  const c = el('div.couv', {}, el('span.dos', { 'aria-hidden': 'true' }), el('span.type', { texte: T.types[serie.type] || serie.type }));
  teinte(c, serie.titre);
  const image = serie.photo_le || serie.couverture || serie.couverture_tome || serie.tomes?.find((t) => t.couverture)?.couverture;
  if (image) {
    const v = encodeURIComponent(image); // change quand la photo ou l'image change
    const img = el('img', { src: `/api/couverture/${serie.id}?v=${v}`, alt: '', loading: 'lazy', decoding: 'async' });
    img.addEventListener('error', () => { img.remove(); c.prepend(el('div.titre-couv', { texte: serie.titre })); });
    c.prepend(img);
  } else c.prepend(el('div.titre-couv', { texte: serie.titre }));
  return c;
}

// Le tome en volume (18/11) : la couverture + la tranche des pages (CSS), et un liseré d'avancement (part de 0 à 1).
export function objetLivre(c, part = 0) {
  if (part > 0) {
    const a = el('span.avancement', { 'aria-hidden': 'true' });
    a.style.setProperty('--p', String(Math.min(1, part))); // CSSOM : permis par la CSP (pas d'attribut style)
    c.append(a);
  }
  return el('div.objet', {}, c);
}
