// Bibliothèque : une étagère par type (04/11 : mangas, BD, livres… chacun la sienne), recherche, filtre par type.
import { T } from '../textes.js';
import { api, el, teinte, couverture, dateCourte } from '../commun.js';

let filtre = 'tout';
let texte = '';
let categorie = '';
const categoriesDe = (s) => [T.publics[s.public], ...String(s.genres || '').split('|')].map((g) => g?.trim()).filter((g) => g && g !== '—');

function carte(s) {
  const parus = Math.max(s.parus, s.nb_possedes);
  const c = couverture(s);
  if (s.envie) c.append(el('span.ruban', { texte: T.aAcheter }));
  c.append(el('div.compteur', {}, s.envie ? el('span', { texte: T.tomesParus(parus) }) : el('span', {}, el('b', { texte: String(s.nb_possedes) }), ` / ${parus}`),
    s.prochaine_sortie ? el('span.pastille-sortie', { texte: `▸ ${dateCourte(s.prochaine_sortie)}` }) : ''));
  const a = el('a.livre', { href: `#/serie/${s.id}`, 'aria-label': s.envie ? `${s.titre}, à acheter, ${T.tomesParus(parus)}` : `${s.titre}, ${s.nb_possedes} tomes sur ${parus}` }, c, el('p.nom', { texte: s.titre }));
  return el('li', {}, teinte(a, s.titre));
}

export async function vueBibliotheque() {
  const toutes = await api('series');
  const envies = toutes.filter((s) => s.envie);
  const series = toutes.filter((s) => !s.envie); // « À acheter » à part : ne compte ni dans « Tout » ni dans le total
  const mur = el('div.etageres');
  const vide = el('div.vide');
  const ordre = Object.keys(T.types);
  const dessiner = () => {
    const t = texte.trim().toLowerCase();
    const liste = (filtre === 'envie' ? envies : series).filter((s) => (filtre === 'tout' || filtre === 'envie' || s.type === filtre) && (!categorie || categoriesDe(s).includes(categorie)) && (!t || s.titre.toLowerCase().includes(t)));
    // une étagère par type, dans l'ordre des types ; « À acheter » reste une seule étagère
    const groupes = filtre === 'envie' ? [['envie', liste]] : ordre.map((ty) => [ty, liste.filter((s) => s.type === ty)]).filter(([, l]) => l.length);
    mur.replaceChildren(...groupes.map(([ty, l]) => el('section.etagere', { 'aria-label': ty === 'envie' ? T.aAcheter : T.etageres[ty] || ty },
      groupes.length > 1 || filtre === 'tout' ? el('h3.etagere-titre', {}, ty === 'envie' ? T.aAcheter : T.etageres[ty] || ty, el('span', { texte: ` · ${l.length}` })) : '',
      el('ul.mur', {}, ...l.map(carte)))));
    const [titre, aide] = toutes.length ? T.videRecherche : T.videBiblio;
    vide.replaceChildren(el('strong', { texte: titre }), aide, toutes.length ? '' : el('p', {}, el('a.bouton.or', { href: '#/ajouter', texte: T.ajouter })));
    vide.hidden = liste.length > 0;
  };
  const types = ['tout', ...ordre.filter((ty) => series.some((s) => s.type === ty)), ...(envies.length ? ['envie'] : [])];
  if (filtre === 'envie' && !envies.length) filtre = 'tout';
  const puces = el('div.filtres', { role: 'group', 'aria-label': 'Filtrer par type' }, ...types.map((ty) => el('button.puce', {
    'aria-pressed': String(ty === filtre), texte: ty === 'tout' ? `${T.tout} · ${series.length}` : ty === 'envie' ? `${T.aAcheter} · ${envies.length}` : T.types[ty] || ty,
    onclick: (e) => { filtre = ty; puces.querySelectorAll('.puce').forEach((p) => p.setAttribute('aria-pressed', String(p === e.currentTarget))); remplirCats?.(); dessiner(); },
  })));
  const recherche = el('div.recherche', {}, el('label.sr', { for: 'cherche', texte: T.rechercher }),
    el('input', { id: 'cherche', type: 'search', placeholder: T.rechercher, value: texte, oninput: (e) => { texte = e.target.value; dessiner(); } }));
  const toutesCats = [...new Set(toutes.flatMap(categoriesDe))].sort((a, b) => a.localeCompare(b, 'fr'));
  if (categorie && !toutesCats.includes(categorie) && !T.genresRoman.includes(categorie)) categorie = '';
  // 04/11 : sur l'étagère Livres, toutes les sortes de romans (light novel, policier…), même celles encore vides
  const select = el('select', { onchange: (e) => { categorie = e.target.value; dessiner(); } });
  const remplirCats = () => {
    const livres = filtre === 'livre';
    const dans = (filtre === 'tout' || filtre === 'envie' ? toutes : toutes.filter((s) => s.type === filtre));
    const cats = livres ? [...new Set([...T.genresRoman, ...dans.flatMap(categoriesDe)])] : [...new Set(dans.flatMap(categoriesDe))].sort((a, b) => a.localeCompare(b, 'fr'));
    if (categorie && !cats.includes(categorie)) categorie = '';
    const nb = (c) => dans.filter((s) => categoriesDe(s).includes(c)).length;
    select.replaceChildren(el('option', { value: '', texte: livres ? T.toutesSortesRoman : T.toutes }),
      ...cats.map((c) => el('option', { value: c, selected: c === categorie, texte: nb(c) ? `${c} · ${nb(c)}` : c })));
  };
  remplirCats();
  const choixCat = toutesCats.length || series.some((s) => s.type === 'livre') ? el('label.categorie', {}, el('span.sr', { texte: T.categorie }), select) : '';
  dessiner();
  const possedes = series.reduce((n, s) => n + s.nb_possedes, 0);
  const nonLus = series.reduce((n, s) => n + (s.nb_non_lus || 0), 0);
  return el('section', { 'aria-labelledby': 't-biblio' },
    el('h2.sr', { id: 't-biblio', texte: T.bibliotheque }),
    series.length ? el('p.meta', {}, `${series.length} séries · ${possedes} tomes`,
      ' · ', el('a.lien-pile', { href: '#/pile', texte: nonLus ? `${T.pile} : ${T.nonLus(nonLus)}` : `${T.pile} : vide` })) : '', // toujours visible (04/11)
    toutes.length > 3 ? recherche : '', types.length > 2 || envies.length ? puces : '', choixCat, mur, vide);
}
