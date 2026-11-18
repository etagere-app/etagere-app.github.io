// Ajouter : une série (saisie), une liste (import), une photo (préparée par Claude dans la conversation).
import { T } from '../textes.js';
import { api, el, message, erreur } from '../commun.js';

function saisie() {
  const f = el('form.carte', {
    onsubmit: async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f));
      try {
        const { id } = await api('series', { method: 'POST', corps: { ...d, nb_parus: Number(d.nb_parus || 0) } });
        location.hash = `#/serie/${id}`;
      } catch (x) { erreur(x); }
    },
  },
  el('label.champ', {}, el('span', { texte: T.titre }), el('input', { name: 'titre', required: true, maxlength: '200', autocomplete: 'off' })),
  el('label.champ', {}, el('span', { texte: T.type }), el('select', { name: 'type' }, ...Object.entries(T.types).map(([k, v]) => el('option', { value: k, texte: v })))),
  el('label.champ', {}, el('span', { texte: T.editeur }), el('input', { name: 'editeur' })),
  el('label.champ', {}, el('span', { texte: T.tomesPossedes }), el('input', { name: 'tomes', inputmode: 'numeric', placeholder: '1-12' }), el('small.aide', { texte: T.aideTomes })),
  el('label.champ', {}, el('span', { texte: T.nbParus }), el('input', { name: 'nb_parus', type: 'number', min: '0', max: '999' })),
  el('label.case', {}, el('input', { type: 'checkbox', name: 'envie' }), el('span', { texte: T.envieCase })),
  el('button.bouton.or', { type: 'submit', texte: T.ajouterSerie }));
  return f;
}

function liste() {
  const zone = el('textarea', { name: 'texte', placeholder: T.exempleImport, 'aria-label': T.ongletImport });
  const dejaLus = el('input', { type: 'checkbox', checked: true }); // 18/11 : une liste importée = surtout des tomes déjà lus
  const f = el('form.carte', {
    onsubmit: async (e) => {
      e?.preventDefault();
      try {
        const r = await api('import', { method: 'POST', corps: { texte: zone.value, deja_lus: dejaLus.checked } });
        message(`${r.ajoutees} ajoutée(s), ${r.completees} complétée(s)`);
        location.hash = '#/';
      } catch (x) { erreur(x, () => f.requestSubmit()); } // le texte reste dans le champ
    },
  }, el('p.aide', { texte: T.aideImport }), el('label.champ', {}, zone), el('label.case', {}, dejaLus, el('span', { texte: T.dejaLus })),
  el('button.bouton.or', { type: 'submit', texte: T.importer }));
  return f;
}

export async function vueAjouter() {
  const contenu = el('div');
  const onglets = [[T.ongletSaisie, saisie], [T.ongletImport, liste], [T.ongletPhoto, () => el('div.carte', {}, el('p', { texte: T.aidePhoto }))]];
  // 18/11 : simples boutons à bascule (aria-pressed), comme les modes de la fiche série, plutôt qu'un faux role=tab
  const barre = el('div.onglets', { role: 'group', 'aria-label': 'Quoi ajouter' });
  const choisir = (i) => {
    barre.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)));
    contenu.replaceChildren(onglets[i][1]());
  };
  onglets.forEach(([t], i) => barre.append(el('button', { type: 'button', texte: t, onclick: () => choisir(i) })));
  choisir(0);
  return el('section', { 'aria-labelledby': 't-ajouter' }, el('h2', { id: 't-ajouter', texte: T.ajouter }), barre, contenu);
}
