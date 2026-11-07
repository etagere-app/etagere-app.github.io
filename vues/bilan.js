// Bilan de lecture : totaux de la collection, « cette année », répartition par type.
import { T } from '../textes.js';
import { api, el } from '../commun.js';

const TYPES = { manga: 'Mangas', manhwa: 'Manhwas', manhua: 'Manhuas', bd: 'BD', comics: 'Comics', livre: 'Romans', jdr: 'JDR' };

export async function vueBilan() {
  const b = await api('bilan');
  const zone = el('section', { 'aria-labelledby': 't-bilan' });
  const tuile = (valeur, libelle) => el('div.stat', {}, el('b', { texte: String(valeur) }), el('span', { texte: libelle }));
  zone.append(el('h2', { id: 't-bilan', texte: T.bilan }));
  if (!b.tomes && !b.series) {
    zone.append(el('div.vide', {}, el('strong', { texte: T.bilanVide })));
    return zone;
  }
  zone.append(
    el('div.stats', {},
      tuile(b.tomes, T.tTomes), tuile(b.series, T.tSeries), tuile(b.lus, T.tLus),
      tuile(b.non_lus, T.tNonLus), tuile(b.pretes, T.tPretes), tuile(b.a_acheter, T.tAAcheter)),
    (b.achetes_annee || b.lus_annee) ? el('div', {},
      el('h3.sous-titre', { texte: T.cetteAnnee(b.annee) }),
      el('div.stats', {}, tuile(b.achetes_annee, T.achetesAnnee), tuile(b.lus_annee, T.lusAnnee))) : '',
    b.parType && b.parType.length ? el('div', {},
      el('h3.sous-titre', { texte: T.repartition }),
      el('div.repartition', {}, ...b.parType.map((x) => el('div.rep', {}, el('b', { texte: String(x.n) }), el('span', { texte: TYPES[x.type] || x.type || '—' }))))) : '',
  );
  return zone;
}
