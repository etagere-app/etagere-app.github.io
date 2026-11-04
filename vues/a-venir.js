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
    zone.append(teinte(el('a.sortie', { href: `#/serie/${s.serie_id}` },
      el('div.jour', {}, String(d.getDate()), el('small', { texte: d.toLocaleDateString('fr-FR', { weekday: 'short' }) })),
      el('div', {}, el('div', { texte: s.titre }), s.sortie_a_confirmer ? el('span.a-confirmer', { texte: T.aConfirmer }) : el('span.a-confirmer', { texte: s.sortie_source === 'saisie' ? 'date notée à la main' : s.sortie_source ? `annoncé · ${s.sortie_source}` : '' })),
      el('div.n', { texte: aDesSaisons(s.saisons) ? `S${versLocal(s.saisons, s.numero).saison} T.${versLocal(s.saisons, s.numero).numero}` : `T.${s.numero}` })), s.titre));
  }
  return zone;
}
