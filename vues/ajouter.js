// Ajouter : une série (saisie), une liste (import), une photo (préparée par Claude dans la conversation).
import { T } from '../textes.js';
import { api, el, message } from '../commun.js';

function saisie() {
  const f = el('form.carte', {
    onsubmit: async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f));
      try {
        const { id } = await api('series', { method: 'POST', corps: { ...d, nb_parus: Number(d.nb_parus || 0) } });
        location.hash = `#/serie/${id}`;
      } catch (x) { message(x.message); }
    },
  },
  el('label.champ', {}, el('span', { texte: T.titre }), el('input', { name: 'titre', required: true, maxlength: '200', autocomplete: 'off' })),
  el('label.champ', {}, el('span', { texte: T.type }), el('select', { name: 'type' }, ...Object.entries(T.types).map(([k, v]) => el('option', { value: k, texte: v })))),
  el('label.champ', {}, el('span', { texte: T.editeur }), el('input', { name: 'editeur' })),
  el('label.champ', {}, el('span', { texte: T.tomesPossedes }), el('input', { name: 'tomes', inputmode: 'numeric', placeholder: '1-12' }), el('small.aide', { texte: T.aideTomes })),
  el('label.champ', {}, el('span', { texte: T.nbParus }), el('input', { name: 'nb_parus', type: 'number', min: '0', max: '999' })),
  el('label.case', {}, el('input', { type: 'checkbox', name: 'envie' }), el('span', { texte: T.envieCase })),
  el('button.bouton.or', { type: 'submit', texte: T.ajouter }));
  return f;
}

function liste() {
  const zone = el('textarea', { name: 'texte', placeholder: T.exempleImport, 'aria-label': T.ongletImport });
  const f = el('form.carte', {
    onsubmit: async (e) => {
      e.preventDefault();
      const r = await api('import', { method: 'POST', corps: { texte: zone.value } });
      message(`${r.ajoutees} ajoutée(s), ${r.completees} complétée(s)`);
      location.hash = '#/';
    },
  }, el('p.aide', { texte: T.aideImport }), el('label.champ', {}, zone), el('button.bouton.or', { type: 'submit', texte: T.importer }));
  return f;
}

export async function vueAjouter() {
  const contenu = el('div');
  const onglets = [[T.ongletSaisie, saisie], [T.ongletImport, liste], [T.ongletPhoto, () => el('div.carte', {}, el('p', { texte: T.aidePhoto }))]];
  const barre = el('div.onglets', { role: 'tablist' });
  const choisir = (i) => {
    barre.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-selected', String(i === j)));
    contenu.replaceChildren(onglets[i][1]());
  };
  onglets.forEach(([t], i) => barre.append(el('button', { role: 'tab', type: 'button', texte: t, onclick: () => choisir(i) })));
  choisir(0);
  return el('section', { 'aria-labelledby': 't-ajouter' }, el('h2', { id: 't-ajouter', texte: T.ajouter }), barre, contenu);
}
