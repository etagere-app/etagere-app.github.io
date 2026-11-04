// Pile de la honte (04/11) : tomes achetés pas encore lus, regroupés par série, les plus vieux achats d'abord.
// Un toucher sur un tome = lu (il quitte la pile) ; « Tout lu » vide la pile d'une série.
import { T } from '../textes.js';
import { api, el, teinte, message } from '../commun.js';
import { versLocal, aDesSaisons } from '../saisons.js';

export async function vuePile() {
  const pile = await api('pile');
  const zone = el('section', { 'aria-labelledby': 't-pile' });
  const compte = el('p.meta');
  const liste = el('div.pile');
  const dessiner = () => {
    compte.textContent = pile.length ? T.nonLus(pile.length) : '';
    const series = [...new Map(pile.map((t) => [t.serie_id, t])).values()]; // ordre du plus vieil achat
    liste.replaceChildren(...(pile.length ? series.map((s) => {
      const tomes = pile.filter((t) => t.serie_id === s.serie_id);
      const ul = teinte(el('ul.tomes'), s.titre);
      for (const t of tomes) {
        const n = aDesSaisons(t.saisons) ? versLocal(t.saisons, t.numero) : { numero: t.numero };
        const b = el('button.tome.possede.non-lu', { 'aria-label': `${s.titre}, tome ${t.numero} : marquer comme lu`, onclick: async () => {
          await api(`series/${t.serie_id}/tomes/${t.numero}`, { method: 'PUT', corps: { lu: true } });
          pile.splice(pile.indexOf(t), 1); message(T.lu(`${s.titre} ${n.saison ? `S${n.saison} ` : ''}n°${n.numero}`)); dessiner();
        } }, t.couverture ? el('img', { src: `/api/couverture/${t.serie_id}/${t.numero}`, alt: '', loading: 'lazy', decoding: 'async' }) : '',
        el('span.n', { texte: String(n.numero) }));
        if (t.couverture) { b.classList.add('illustre'); b.querySelector('img').addEventListener('error', (e) => { e.target.remove(); b.classList.remove('illustre'); }); }
        ul.append(el('li', {}, b));
      }
      return el('section.pile-serie', { 'aria-label': s.titre },
        el('div.pile-tete', {}, el('h3', {}, el('a', { href: `#/serie/${s.serie_id}`, texte: s.titre }), el('span', { texte: ` · ${tomes.length}` })),
          el('button.bouton.discret', { texte: T.toutLu, onclick: async () => {
            await api(`series/${s.serie_id}/tout-lu`, { method: 'POST' });
            for (const t of tomes) pile.splice(pile.indexOf(t), 1);
            message(T.lu(s.titre)); dessiner();
          } })),
        ul);
    }) : [el('div.vide', {}, el('strong', { texte: T.pileVide[0] }), T.pileVide[1])]));
  };
  dessiner();
  zone.append(el('h2', { id: 't-pile', texte: T.pile }), compte, el('p.aide', { texte: T.aidePile }), liste);
  return zone;
}
