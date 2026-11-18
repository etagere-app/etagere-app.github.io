// À venir : prochaines sorties françaises de toutes les séries, par mois.
import { T } from '../textes.js';
import { api, el, teinte } from '../commun.js';
import { versLocal, aDesSaisons } from '../saisons.js';

export async function vueAVenir() {
  const sorties = await api('a-venir');
  const zone = el('section', { 'aria-labelledby': 't-avenir' }, el('h2', { id: 't-avenir', texte: T.aVenir }));
  if (!sorties.length) return zone.appendChild(el('div.vide', {}, el('strong', { texte: T.videAVenir[0] }), T.videAVenir[1])) && zone;
  let mois = '';
  for (const s of sorties) {
    const d = new Date(`${s.sortie_le}T12:00:00`);
    const m = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    if (m !== mois) { mois = m; zone.append(el('h3.mois', { texte: m })); }
    // 18/11 : la source (adresse) devient un lien « source » ; la ligne entière reste un lien vers la série (lien étiré en CSS)
    const web = /^https:\/\//.test(s.sortie_source || '');
    const source = web ? el('a.source', { href: s.sortie_source, target: '_blank', rel: 'noopener noreferrer', texte: `${T.source} : ${new URL(s.sortie_source).hostname.replace(/^www\./, '')}` })
      : s.sortie_source === 'saisie' ? 'date notée à la main' : s.sortie_source ? `annoncé · ${s.sortie_source}` : '';
    zone.append(teinte(el('div.sortie', {},
      el('div.jour', {}, String(d.getDate()), el('small', { texte: d.toLocaleDateString('fr-FR', { weekday: 'short' }) })),
      el('div', {}, el('a.lien-serie', { href: `#/serie/${s.serie_id}`, texte: s.titre }),
        el('span.a-confirmer', {}, s.sortie_a_confirmer ? `${T.aConfirmer}${web ? ' · ' : ''}` : '', s.sortie_a_confirmer && !web ? '' : source)),
      el('div.n', { texte: aDesSaisons(s.saisons) ? `S${versLocal(s.saisons, s.numero).saison} T.${versLocal(s.saisons, s.numero).numero}` : `T.${s.numero}` })), s.titre));
  }
  return zone;
}
