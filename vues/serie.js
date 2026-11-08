// Fiche d'une série : tous les n° en grille (possédé / manquant / à paraître).
// Un toucher coche ou décoche, ou ouvre la fiche du tome (choix mémorisé sur l'appareil).
import { T } from '../textes.js';
import { api, el, icone, teinte, couverture, message, dateCourte } from '../commun.js';
import { ouvrirTome, photographierCouverture } from './tome.js';
import { lireSaisons, versLocal, aDesSaisons, libelleTome, nomSaison } from '../saisons.js';

const lireMode = () => { try { return localStorage.getItem('etagere-mode-tome') || 'cocher'; } catch { return 'cocher'; } };
const ecrireMode = (m) => { try { localStorage.setItem('etagere-mode-tome', m); } catch { /* stockage bloqué */ } };

// Remplit les fiches (auteur, résumé, couvertures…) par paquets de 40 requêtes, tant qu'il en reste.
export async function completerFiches(surProgres) {
  let total = 0, pauses = 0;
  for (let i = 0; i < 40; i++) {
    const r = await api('completer', { method: 'POST' });
    total += r.trouves;
    surProgres?.(r);
    if (!r.restant) return { total, restant: 0 };
    if (!r.faits) { // Google limite les requêtes par minute : on attend et on reprend (3 fois au plus)
      if (++pauses > 3) return { total, restant: r.restant };
      await new Promise((ok) => setTimeout(ok, 30000));
    }
  }
  return { total, restant: null };
}

function grille(serie, maj, rafraichir) {
  const parus = Math.max(serie.nb_parus, ...serie.tomes.map((t) => t.numero), 0);
  const parNum = new Map(serie.tomes.map((t) => [t.numero, t]));
  const saisons = aDesSaisons(serie.saisons) ? lireSaisons(serie.saisons) : null;
  const bouton = (n) => {
    const t = parNum.get(n) || { numero: n, possede: 0 };
    const local = saisons ? versLocal(saisons, n) : { numero: n };
    const avenir = !t.possede && t.sortie_le && t.sortie_le > new Date().toISOString().slice(0, 10);
    const nonLu = t.possede && !t.lu; // pile de la honte : marque-page doré
    const titreTome = t.titre && t.titre !== `${serie.titre} T${n}` ? t.titre : ''; // titre propre (collection de romans : « n°12 · Les Misérables »)
    const b = el(`button.tome${t.possede ? '.possede' : ''}${nonLu ? '.non-lu' : ''}${avenir ? '.avenir' : ''}`, {
      'aria-pressed': String(!!t.possede),
      title: titreTome || undefined,
      'aria-label': `${libelleTome(serie.saisons, n, serie.saisons_noms)}${titreTome ? ` · ${titreTome}` : ''} : ${t.possede ? `${T.lPossede}${nonLu ? `, ${T.lNonLu.toLowerCase()}` : ''}` : avenir ? `${T.lAvenir} le ${dateCourte(t.sortie_le)}` : T.lManque}`,
      onclick: async () => {
        if (lireMode() === 'fiche') return ouvrirTome(serie, t, rafraichir);
        if (lireMode() === 'lire') {
          if (!t.possede) return message(T.cocherDabord);
          await api(`series/${serie.id}/tomes/${n}`, { method: 'PUT', corps: { lu: !t.lu } });
          t.lu = t.lu ? 0 : 1; return maj(n);
        }
        const possede = !t.possede;
        await api(`series/${serie.id}/tomes/${n}`, { method: 'PUT', corps: { possede } });
        t.possede = possede ? 1 : 0;
        if (!parNum.has(n)) serie.tomes.push(t);
        maj(n);
      },
    }, t.couverture ? el('img', { src: `/api/couverture/${serie.id}/${n}`, alt: '', loading: 'lazy', decoding: 'async' }) : '',
    el('span.n', { texte: String(local.numero) }), avenir ? el('small', { texte: dateCourte(t.sortie_le) }) : '');
    if (t.couverture) { b.classList.add('illustre'); b.querySelector('img').addEventListener('error', (e) => { e.target.remove(); b.classList.remove('illustre'); }); }
    return el('li', {}, b);
  };
  const rangee = (debut, fin, label) => {
    const ul = teinte(el('ul.tomes', { 'aria-label': label }), serie.titre);
    for (let n = debut; n <= fin; n++) ul.append(bouton(n));
    return ul;
  };
  if (!saisons) return rangee(1, parus, 'Tomes');
  // 04/11 : une rangée par saison (Hajime no Ippo…), chacune repart au tome 1
  const zone = el('div.saisons');
  saisons.forEach((s, i) => {
    const fin = i + 1 < saisons.length ? saisons[i + 1].debut - 1 : parus;
    if (fin < s.debut) return;
    const nom = nomSaison(serie.saisons_noms, s.saison) || `Saison ${s.saison}`;
    zone.append(el('h3.saison-titre', { texte: `${nom} · ${fin - s.debut + 1} tome${fin > s.debut ? 's' : ''}` }), rangee(s.debut, fin, nom));
  });
  return zone;
}

function formulaire(serie, rafraichir) {
  const f = el('form.carte', {
    onsubmit: async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f));
      await api(`series/${serie.id}`, { method: 'PATCH', corps: { ...d, nb_parus: Number(d.nb_parus) } });
      message('Enregistré'); rafraichir();
    },
  });
  const champ = (nom, libelle, input) => el('label.champ', {}, el('span', { texte: libelle }), input);
  const select = (nom, options, val) => el('select', { name: nom }, ...Object.entries(options).map(([k, v]) => el('option', { value: k, selected: k === val, texte: v })));
  f.append(
    champ('titre', T.titre, el('input', { name: 'titre', value: serie.titre, required: true, maxlength: '200' })),
    champ('type', T.type, select('type', T.types, serie.type)),
    champ('editeur', T.editeur, el('input', { name: 'editeur', value: serie.editeur || '' })),
    champ('statut', T.statut, select('statut', T.statuts, serie.statut)),
    champ('public', T.public, select('public', T.publics, serie.public || '')),
    champ('genres', T.genres, el('input', { name: 'genres', value: serie.genres || '', placeholder: 'Fantasy | Action' })),
    champ('nb_parus', T.nbParus, el('input', { name: 'nb_parus', type: 'number', min: '0', max: '999', value: String(serie.nb_parus) })),
    champ('note', T.note, el('input', { name: 'note', value: serie.note || '' })),
    champ('auteur', T.auteur, el('input', { name: 'auteur', value: serie.auteur || '' })),
    champ('alias', T.alias, el('input', { name: 'alias', value: serie.alias || '', placeholder: 'Tales of Demons and Gods' })),
    el('small.aide', { texte: T.aideAlias }),
    el('input', { type: 'hidden', name: 'envie', value: '0' }), // case décochée = 0 (FormData garde la dernière valeur)
    el('label.case', {}, el('input', { type: 'checkbox', name: 'envie', value: '1', checked: !!serie.envie }), el('span', { texte: T.envieCase })),
    el('div.actions', {}, el('button.bouton', { type: 'submit', texte: T.enregistrer }), el('button.bouton.discret', { type: 'button', texte: T.annuler, onclick: () => f.remove() })),
  );
  let confirme = false;
  f.append(el('div.actions', {}, el('button.bouton.danger', {
    type: 'button', texte: T.supprimer,
    onclick: async (e) => {
      if (!confirme) { confirme = true; e.currentTarget.textContent = T.confirmerSuppression; return; }
      await api(`series/${serie.id}`, { method: 'DELETE' }); location.hash = '#/';
    },
  })));
  return f;
}

// Ranger cette série (un arc : « Sword Art Online - Aincrad ») comme SAISON NOMMÉE d'une série parente.
function formRanger(serie) {
  const choix = el('select', { name: 'cible' }, el('option', { value: '', texte: `+ ${T.nouvelleSerie}` }));
  const titre = el('input', { placeholder: T.titre, 'aria-label': T.titre });
  const nom = el('input', { value: serie.titre, 'aria-label': T.nomSaisonArc, maxlength: '60' });
  api('series').then((series) => series.filter((s) => s.id !== serie.id).forEach((s) => choix.append(el('option', { value: String(s.id), texte: s.titre })))).catch(() => {});
  const maj = () => { titre.hidden = !!choix.value; };
  choix.addEventListener('change', maj);
  const f = el('form.carte', {
    onsubmit: async (e) => {
      e.preventDefault();
      if (!choix.value && !titre.value.trim()) { message(T.titre); titre.focus(); return; }
      const bouton = e.submitter || e.currentTarget.querySelector('button[type="submit"]'); bouton.disabled = true;
      try {
        const r = await api(`series/${serie.id}/ranger-saison`, { method: 'POST', corps: {
          cible_id: choix.value ? Number(choix.value) : null, titre: titre.value.trim(), type: serie.type, nom: nom.value.trim() } });
        message(T.serieRangee); location.hash = `#/serie/${r.serie_id}`;
      } catch (x) { message(x.message || T.erreurReseau); bouton.disabled = false; }
    },
  }, el('p.aide', { texte: T.rangerAide }),
    el('label.champ', {}, el('span', { texte: T.serieParente }), choix), titre,
    el('label.champ', {}, el('span', { texte: T.nomSaisonArc }), nom),
    el('div.actions', {}, el('button.bouton', { type: 'submit', texte: T.ranger }), el('button.bouton.discret', { type: 'button', texte: T.annuler, onclick: () => f.remove() })));
  maj();
  return f;
}

export async function vueSerie(id) {
  const serie = await api(`series/${id}`);
  const zone = el('section', { 'aria-labelledby': 't-serie' });
  const stats = el('div.stats');
  const dessinerStats = () => {
    const jour = new Date().toISOString().slice(0, 10);
    // parus = tomes déjà sortis (un tome annoncé n'est pas « manquant »)
    const parus = Math.max(serie.nb_parus, ...serie.tomes.filter((t) => t.possede || !t.sortie_le || t.sortie_le <= jour).map((t) => t.numero), 0);
    const pos = serie.tomes.filter((t) => t.possede).length;
    const manque = Math.max(0, parus - serie.tomes.filter((t) => t.possede && t.numero <= parus).length);
    const nonLus = serie.tomes.filter((t) => t.possede && !t.lu).length;
    const prochain = serie.tomes.filter((t) => !t.possede && t.sortie_le > jour).sort((a, b) => a.numero - b.numero)[0];
    stats.replaceChildren(
      el('div', {}, el('b', { texte: String(pos) }), pos > 1 ? T.possedes : 'possédé'),
      el('div', {}, el('b', { texte: String(manque) }), manque > 1 ? T.manquants : 'manquant'),
      nonLus ? el('div', {}, el('a.stat-pile', { href: '#/pile' }, el('b', { texte: String(nonLus) }), nonLus > 1 ? 'non lus' : 'non lu')) : '',
      prochain ? el('div', {}, el('b', { texte: aDesSaisons(serie.saisons) ? `S${versLocal(serie.saisons, prochain.numero).saison} n°${versLocal(serie.saisons, prochain.numero).numero}` : `n°${prochain.numero}` }), dateCourte(prochain.sortie_le)) : '');
  };
  let grilleEl;
  const rafraichir = async () => zone.replaceWith(await vueSerie(id));
  const maj = (n) => {
    const nouvelle = grille(serie, maj, rafraichir);
    grilleEl.replaceWith(nouvelle); grilleEl = nouvelle;
    nouvelle.querySelectorAll('.tome')[n - 1]?.classList.add('vient');
    nouvelle.querySelectorAll('.tome')[n - 1]?.focus();
    dessinerStats();
    if (serie.tomes.some((t) => t.possede)) document.querySelector('.ruban.dans-fiche')?.remove(); // 1er tome : la série entre dans la collection
  };
  grilleEl = grille(serie, maj, rafraichir);
  dessinerStats();
  const fiche = teinte(el('div.fiche', {}, couverture(serie), el('div', {},
    serie.envie ? el('span.ruban.dans-fiche', { texte: T.aAcheter }) : '',
    el('h2', { id: 't-serie', texte: serie.titre }),
    el('p.meta', { texte: [T.types[serie.type], serie.editeur, T.statuts[serie.statut]].filter(Boolean).join(' · ') }),
    serie.auteur ? el('p.meta', { texte: serie.auteur }) : '',
    serie.public || serie.genres ? el('p.etiquettes', {}, ...[T.publics[serie.public], ...String(serie.genres || '').split('|')].map((g) => g?.trim()).filter(Boolean).map((g) => el('span', { texte: g }))) : '',
    stats)), serie.titre);
  const legende = el('p.legende', {}, el('span.l-possede', { texte: T.lPossede }), el('span.l-non-lu', { texte: T.lNonLu }), el('span.l-manque', { texte: T.lManque }), el('span.l-avenir', { texte: T.lAvenir }));
  teinte(legende, serie.titre);
  const actions = el('div.actions', {},
    el('button.bouton.discret', { texte: T.modifier, onclick: (e) => e.currentTarget.parentNode.after(formulaire(serie, rafraichir)) }),
    el('button.bouton.discret', { texte: T.photoCouverture, onclick: () => photographierCouverture(serie, rafraichir) }),
    el('button.bouton.discret', { texte: T.completerFiche, onclick: async (e) => {
      e.currentTarget.disabled = true; message('Recherche des infos…');
      try { const r = await completerFiches(); message(`${r.total} tome(s) complété(s)`); rafraichir(); } catch (x) { message(x.message); e.currentTarget.disabled = false; }
    } }),
    el('button.bouton.discret', { texte: T.rangerSaison, onclick: (e) => e.currentTarget.closest('.actions').after(formRanger(serie)) }));
  const modes = el('div.onglets.modes', { role: 'group', 'aria-label': T.toucherUnNumero },
    ...[['cocher', T.modeCocher], ['lire', T.modeLire], ['fiche', T.modeFiche]].map(([m, t]) => el('button', {
      type: 'button', 'aria-pressed': String(lireMode() === m), 'aria-selected': String(lireMode() === m), texte: t,
      onclick: (e) => { ecrireMode(m); modes.querySelectorAll('button').forEach((b) => { const v = String(b === e.currentTarget); b.setAttribute('aria-pressed', v); b.setAttribute('aria-selected', v); }); },
    })));
  const resume = serie.resume ? el('details.resume', { open: true }, el('summary', { texte: T.resume }), el('p', { texte: serie.resume })) : '';
  const sansJaquette = serie.tomes.filter((t) => t.possede && !t.couverture).length; // 04/11 : l'automate les cherche, au plus tard le dimanche
  const attente = sansJaquette ? el('p.aide.jaquettes-attente', { texte: T.jaquettesDimanche(sansJaquette) }) : '';
  zone.append(el('a.retour', { href: '#/' }, icone('retour'), T.bibliotheque), fiche, resume, modes, legende, attente,
    serie.nb_parus || serie.tomes.length ? grilleEl : el('p.aide', { texte: 'Indique le nombre de tomes parus (Modifier la série) pour voir la grille.' }),
    serie.note ? el('p.meta', { texte: serie.note }) : '', actions);
  return zone;
}
