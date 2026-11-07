// Outils partagés par les vues : appels à l'API, création d'éléments, teinte des séries, message bref.
import { T } from './textes.js';

export class NonConnecte extends Error {}

export async function api(chemin, { method = 'GET', corps } = {}) {
  const r = await fetch(`/api/${chemin}`, {
    method, credentials: 'same-origin',
    headers: corps ? { 'Content-Type': 'application/json' } : {},
    body: corps ? JSON.stringify(corps) : undefined,
  });
  if (r.status === 401 && chemin !== 'connexion') throw new NonConnecte();
  const j = await r.json().catch(() => ({}));
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

let minuteur;
export function message(texte) {
  document.querySelector('.message')?.remove();
  const m = el('div.message', { role: 'status', texte });
  document.body.append(m);
  clearTimeout(minuteur);
  minuteur = setTimeout(() => m.remove(), 2600);
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
  const c = el('div.couv', {}, el('span.type', { texte: T.types[serie.type] || serie.type }));
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
