// Version libre : sauvegarde de la bibliothèque (fichier SQLite) vers iCloud Drive, Google Drive ou Fichiers par le menu
// Partager du téléphone, rappel chaque semaine, et restauration depuis ce fichier. Rien ne passe par un serveur.
import { el, message } from './commun.js';
import { T } from './textes.js';

export const T_SAUVEGARDE = {
  sauvegarder: 'Sauvegarder ma bibliothèque', restaurer: 'Reprendre une sauvegarde',
  rappel: (jours) => (jours === null ? 'Ta bibliothèque n’est sauvegardée nulle part : si tu supprimes l’appli ou changes de téléphone, elle est perdue.'
    : `Dernière sauvegarde il y a ${jours} jours.`),
  aide: 'iPhone : « Enregistrer dans Fichiers » → iCloud Drive. Android : Google Drive ou Fichiers. Garde le même nom : la nouvelle remplace l’ancienne.',
  faite: 'Sauvegarde enregistrée.', plusTard: 'Plus tard',
  confirmer: 'Reprendre cette sauvegarde remplace TOUTE la bibliothèque de ce téléphone. Touche encore pour confirmer.',
  reprise: (n) => `Sauvegarde reprise : ${n} série(s).`,
};
const S = T_SAUVEGARDE;

// Le fichier est préparé AVANT l'appui : Safari refuse le partage si on attend le réseau après le geste.
const preparer = async () => new File([await (await fetch('/api/libre/sauvegarde')).arrayBuffer()], 'etagere-sauvegarde.sqlite', { type: 'application/octet-stream' });

async function sauvegarder(pret) {
  const fichier = await pret;
  try {
    if (navigator.canShare?.({ files: [fichier] })) await navigator.share({ files: [fichier], title: 'Étagère : sauvegarde' });
    else { // ordinateur ou navigateur sans partage de fichiers : téléchargement
      const a = el('a', { href: URL.createObjectURL(fichier), download: fichier.name });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60e3);
    }
  } catch (e) { if (e?.name === 'AbortError') return false; throw e; } // partage annulé : pas de date notée
  await fetch('/api/libre/sauvegarde-faite', { method: 'POST' });
  message(S.faite);
  return true;
}

export function boutonSauvegarder(classe = 'bouton.or', apres = () => {}) {
  let pret = preparer();
  return el(`button.${classe}`, { texte: S.sauvegarder, onclick: async () => {
    try { if (await sauvegarder(pret)) apres(); } catch (e) { message(e.message); }
    pret = preparer(); // la bibliothèque a pu changer
  } });
}

// Bouton « Reprendre une sauvegarde » : choix du fichier puis 2e appui pour confirmer
export function boutonRestaurer(apres) {
  const entree = el('input', { type: 'file', accept: '.sqlite,application/octet-stream,application/x-sqlite3', hidden: true });
  let fichier = null;
  const b = el('button.bouton.discret', { texte: S.restaurer, onclick: async () => {
    if (!fichier) return entree.click();
    const r = await fetch('/api/libre/restaurer', { method: 'POST', body: await fichier.arrayBuffer() });
    const j = await r.json().catch(() => ({}));
    fichier = null; b.textContent = S.restaurer;
    message(r.ok ? S.reprise(j.series) : j.erreur || 'Échec.');
    if (r.ok) apres();
  } });
  entree.addEventListener('change', () => { fichier = entree.files?.[0] || null; if (fichier) { b.textContent = S.confirmer; b.classList.add('danger'); } });
  return el('div', {}, b, entree);
}

// Rappel : jamais sauvegardée (et au moins une série) ou dernière sauvegarde il y a 7 jours ou plus
export async function rappelSauvegarde() {
  let etat;
  try { etat = await (await fetch('/api/libre/etat')).json(); } catch { return; }
  if (etat.consultation) { // copie d'un autre appareil : pas de rappel de sauvegarde, un bandeau d'information
    const d = new Date(`${etat.consultation}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    const zone = document.getElementById('contenu');
    if (!zone || zone.querySelector('.consultation')) return;
    zone.prepend(el('div.carte.consultation', { role: 'note' }, el('p', { texte: T.consultation(d) }),
      el('button.bouton.discret', { texte: T.quitterConsultation, onclick: async () => { await fetch('/api/libre/quitter-consultation', { method: 'POST' }); location.hash = '#/'; location.reload(); } })));
    return;
  }
  if (!etat.series || document.querySelector('.bandeau')) return;
  const jours = etat.sauvegarde_le ? Math.floor((Date.now() - Date.parse(etat.sauvegarde_le)) / 864e5) : null;
  if (jours !== null && jours < 7) return;
  try { if (Number(sessionStorage.getItem('etagere-rappel')) > Date.now()) return; } catch { /* rien */ }
  const b = el('div.bandeau', { role: 'region', 'aria-label': S.sauvegarder },
    el('span', {}, el('strong', { texte: S.rappel(jours) }), ' ', S.aide),
    boutonSauvegarder('bouton.or', () => b.remove()),
    el('button.bouton.discret', { texte: S.plusTard, onclick: () => { try { sessionStorage.setItem('etagere-rappel', String(Date.now() + 3600e3)); } catch { /* rien */ } b.remove(); } }));
  document.body.append(b);
}

// ---- « Voir sur un autre appareil » (04/11) : la bibliothèque compressée dans la partie « # » du lien,
// que le navigateur n'envoie jamais au serveur (GitHub ne la voit pas). L'autre appareil l'affiche en consultation seule.
const versB64 = (o) => btoa(String.fromCharCode(...o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const depuisB64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const flux = async (octets, transfo) => new Uint8Array(await new Response(new Blob([octets]).stream().pipeThrough(transfo)).arrayBuffer());

async function preparerLien() {
  const donnees = await (await fetch('/api/libre/instantane')).json();
  const gz = await flux(new TextEncoder().encode(JSON.stringify(donnees)), new CompressionStream('gzip'));
  return `${location.origin}/#/voir/${versB64(gz)}`;
}
export async function lireLien(code) {
  const json = await flux(depuisB64(code), new DecompressionStream('gzip'));
  return JSON.parse(new TextDecoder().decode(json));
}

export function boutonAutreAppareil(apres = () => {}) {
  if (typeof CompressionStream === 'undefined') return '';
  let pret = preparerLien();
  return el('div', {}, el('button.bouton.discret', { texte: T.autreAppareil, onclick: async () => {
    try {
      const url = await pret;
      if (navigator.share) await navigator.share({ title: 'Étagère : ma bibliothèque', url });
      else { await navigator.clipboard.writeText(url); message(T.lienCopie); }
      apres();
    } catch (e) { if (e?.name !== 'AbortError') message(e.message); }
    pret = preparerLien();
  } }), el('p.aide', { texte: T.aideAutreAppareil }));
}

export async function vueVoir(code, revenir) {
  let donnees;
  try { donnees = await lireLien(code); } catch { return el('p.vide', {}, el('strong', { texte: 'Lien abîmé' }), 'Renvoie-toi un nouveau lien depuis ton téléphone.'); }
  const etat = await (await fetch('/api/libre/etat')).json().catch(() => ({}));
  const d = new Date(`${donnees.d}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  let confirme = !etat.series || !!etat.consultation;
  const b = el('button.bouton.or', { texte: T.voirOuvrir, onclick: async () => {
    if (!confirme) { confirme = true; b.textContent = T.voirRemplace; b.classList.add('danger'); return; }
    b.disabled = true; message('…');
    const r = await fetch('/api/libre/consulter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ donnees }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { b.disabled = false; return message(j.erreur || 'Échec.'); }
    message(`${j.series} série(s) affichée(s)`); revenir();
  } });
  return el('section', { 'aria-labelledby': 't-voir' }, el('h2', { id: 't-voir', texte: T.voirTitre }), el('p', { texte: T.voirAide(d, donnees.s?.length || 0) }), b);
}
