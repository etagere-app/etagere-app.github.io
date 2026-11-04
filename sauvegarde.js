// Version libre : sauvegarde de la bibliothèque (fichier SQLite) vers iCloud Drive, Google Drive ou Fichiers par le menu
// Partager du téléphone, rappel chaque semaine, et restauration depuis ce fichier. Rien ne passe par un serveur.
import { el, message } from './commun.js';

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
  if (document.querySelector('.bandeau')) return;
  let etat;
  try { etat = await (await fetch('/api/libre/etat')).json(); } catch { return; }
  if (!etat.series) return;
  const jours = etat.sauvegarde_le ? Math.floor((Date.now() - Date.parse(etat.sauvegarde_le)) / 864e5) : null;
  if (jours !== null && jours < 7) return;
  try { if (Number(sessionStorage.getItem('etagere-rappel')) > Date.now()) return; } catch { /* rien */ }
  const b = el('div.bandeau', { role: 'region', 'aria-label': S.sauvegarder },
    el('span', {}, el('strong', { texte: S.rappel(jours) }), ' ', S.aide),
    boutonSauvegarder('bouton.or', () => b.remove()),
    el('button.bouton.discret', { texte: S.plusTard, onclick: () => { try { sessionStorage.setItem('etagere-rappel', String(Date.now() + 3600e3)); } catch { /* rien */ } b.remove(); } }));
  document.body.append(b);
}
