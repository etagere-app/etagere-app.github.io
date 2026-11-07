// Fiche d'un tome (feuille du bas) : couverture, titre, pages, parution, ISBN, achat, date de sortie modifiable.
import { T } from '../textes.js';
import { libelleTome } from '../saisons.js';
import { api, el, message } from '../commun.js';

const dateLongue = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : null);

export function ouvrirTome(serie, t, apres) {
  const fermer = () => { voile.remove(); feuille.remove(); };
  const voile = el('div.voile', { onclick: fermer });
  const ligne = (libelle, valeur) => (valeur ? el('div', {}, el('dt', { texte: libelle }), el('dd', { texte: String(valeur) })) : '');
  const img = t.couverture ? el('img.tome-couv', { src: `/api/couverture/${serie.id}/${t.numero}`, alt: `Couverture du tome ${t.numero}` }) : '';
  if (img) img.addEventListener('error', () => img.remove());
  const date = el('input', { type: 'date', value: t.sortie_le || '', 'aria-label': T.dateSortie });
  const pretInput = el('input', { type: 'text', maxlength: 60, placeholder: T.aQui, 'aria-label': T.aQui });
  const feuille = el('div.feuille.tome-fiche', { role: 'dialog', 'aria-label': `${serie.titre}, tome ${t.numero}` },
    el('div.tome-tete', {}, img, el('div', {},
      el('p.meta', { texte: serie.titre }),
      el('h3', { texte: libelleTome(serie.saisons, t.numero) }),
      t.titre && t.titre !== `${serie.titre} T${t.numero}` ? el('p.meta', { texte: t.titre }) : '')),
    el('dl.infos', {},
      ligne(T.possedeLe, t.possede ? dateLongue(t.achete_le) || T.oui : null),
      ligne(T.luLe, t.possede && t.lu ? dateLongue(t.lu_le) || T.oui : null),
      ligne(T.preteA, t.prete_a ? `${t.prete_a}${t.prete_le ? ` (${T.depuisLe} ${dateLongue(t.prete_le)})` : ''}` : null),
      ligne(T.parution, dateLongue(t.parution)),
      ligne(T.pages, t.pages),
      ligne('ISBN', t.isbn)),
    t.resume ? el('p.resume', { texte: t.resume }) : '',
    el('button.bouton.or', {
      texte: t.possede ? T.jeNeLaiPlus : T.jeLai,
      onclick: async () => { await api(`series/${serie.id}/tomes/${t.numero}`, { method: 'PUT', corps: { possede: !t.possede } }); fermer(); apres(); },
    }),
    t.possede ? el('button.bouton.discret', { // pile de la honte
      texte: t.lu ? T.pasEncoreLu : T.jeLaiLu,
      onclick: async () => { await api(`series/${serie.id}/tomes/${t.numero}`, { method: 'PUT', corps: { lu: !t.lu } }); fermer(); apres(); },
    }) : '',
    t.possede ? (t.prete_a   // prêt : rendu si déjà prêté, sinon un champ « à qui ? »
      ? el('button.bouton.discret', { texte: T.marquerRendu, onclick: async () => { await api(`series/${serie.id}/tomes/${t.numero}`, { method: 'PUT', corps: { prete_a: '' } }); fermer(); apres(); } })
      : el('form.champ', {
          onsubmit: async (e) => { e.preventDefault(); const nom = pretInput.value.trim(); if (!nom) return message(T.aQui);
            await api(`series/${serie.id}/tomes/${t.numero}`, { method: 'PUT', corps: { prete_a: nom } }); fermer(); apres(); },
        }, el('span', { texte: T.preter }), el('div.recherche', {}, pretInput, el('button.bouton.discret', { texte: T.preter })))
    ) : '',
    el('form.champ', {
      onsubmit: async (e) => {
        e.preventDefault();
        try { await api(`series/${serie.id}/tomes/${t.numero}`, { method: 'PUT', corps: { sortie_le: date.value || null } }); message('Date enregistrée'); fermer(); apres(); }
        catch (x) { message(x.message); }
      },
    }, el('span', { texte: T.dateSortie }), el('div.recherche', {}, date, el('button.bouton.discret', { texte: T.enregistrer }))),
    el('button.bouton.discret', { texte: 'Fermer', onclick: fermer }));
  document.body.append(voile, feuille);
  feuille.querySelector('button').focus();
  feuille.addEventListener('keydown', (e) => e.key === 'Escape' && fermer());
}

// Photo de la couverture : réduite à 600 px de haut (JPEG ~80 Ko) avant l'envoi, pour tenir dans la base gratuite.
export async function photographierCouverture(serie, apres) {
  const choix = el('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
  document.body.append(choix);
  choix.addEventListener('change', async () => {
    const fichier = choix.files[0];
    choix.remove();
    if (!fichier) return;
    try {
      const image = await createImageBitmap(fichier);
      const k = Math.min(1, 600 / image.height);
      const c = Object.assign(document.createElement('canvas'), { width: Math.round(image.width * k), height: Math.round(image.height * k) });
      c.getContext('2d').drawImage(image, 0, 0, c.width, c.height);
      const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.82));
      const r = await fetch(`/api/series/${serie.id}/couverture`, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: blob, credentials: 'same-origin' });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erreur || T.erreurReseau);
      message('Couverture enregistrée');
      apres();
    } catch (x) { message(x.message || T.erreurReseau); }
  });
  choix.click();
}
