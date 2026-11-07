// Prêts en cours : tomes possédés actuellement prêtés (à qui, depuis quand). Bouton « rendu » → le tome revient.
import { T } from '../textes.js';
import { api, el, teinte, message } from '../commun.js';
import { versLocal, aDesSaisons } from '../saisons.js';

const dateLongue = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : null);

export async function vuePrets() {
  let prets = await api('prets');
  const zone = el('section', { 'aria-labelledby': 't-prets' });
  const liste = el('div.prets');
  const dessiner = () => {
    liste.replaceChildren(...(prets.length ? prets.map((t) => {
      const n = aDesSaisons(t.saisons) ? versLocal(t.saisons, t.numero) : { numero: t.numero };
      const couv = t.couverture ? el('img', { src: `/api/couverture/${t.serie_id}/${t.numero}`, alt: '', loading: 'lazy', decoding: 'async' }) : '';
      if (couv) couv.addEventListener('error', (e) => e.target.remove());
      return teinte(el('div.pret', {},
        couv,
        el('div', {},
          el('h3', {}, el('a', { href: `#/serie/${t.serie_id}`, texte: t.titre }), el('span', { texte: ` · n°${n.numero}` })),
          el('p.meta', { texte: `${T.preteA} ${t.prete_a}${t.prete_le ? ` ${T.depuisLe} ${dateLongue(t.prete_le)}` : ''}` })),
        el('button.bouton.discret', {
          texte: T.marquerRendu,
          onclick: async () => {
            await api(`series/${t.serie_id}/tomes/${t.numero}`, { method: 'PUT', corps: { prete_a: '' } });
            prets = prets.filter((x) => x !== t); message(`${t.titre} n°${n.numero} : ${T.marquerRendu}`); dessiner();
          },
        }),
      ), t.titre);
    }) : [el('div.vide', {}, el('strong', { texte: T.aucunPret }))]));
  };
  dessiner();
  zone.append(el('h2', { id: 't-prets', texte: T.prets }), liste);
  return zone;
}
