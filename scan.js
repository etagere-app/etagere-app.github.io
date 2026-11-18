// Scanner : caméra + BarcodeDetector (natif dans Chrome Android), ISBN tapé à la main sinon.
import { T } from './textes.js';
import { api, el, icone, message, erreur, sansAccents } from './commun.js';

export async function ouvrirScanner(apres) {
  let flux = null, fini = false;
  const video = el('video', { playsinline: true, muted: true, autoplay: true, 'aria-hidden': 'true' });
  const panneau = el('div.scan-panneau');
  const avant = document.activeElement, app = document.getElementById('app');
  const fermer = () => { fini = true; flux?.getTracks().forEach((t) => t.stop()); ecran.remove(); app.inert = false; avant?.focus?.(); };
  const ecran = el('div.scan', { role: 'dialog', 'aria-modal': 'true', 'aria-label': T.scanner },
    el('div', {}, video, el('div.viseur', { 'aria-hidden': 'true' }),
      el('button.bouton.discret.scan-fermer', { 'aria-label': T.fermer, onclick: fermer }, icone('fermer'))),
    panneau);
  document.body.append(ecran);
  app.inert = true;
  ecran.querySelector('.scan-fermer').focus();
  ecran.addEventListener('keydown', (e) => e.key === 'Escape' && fermer());

  const saisieManuelle = (texteAide) => {
    const champ = el('input', { inputmode: 'numeric', pattern: '[0-9Xx\\-]{10,17}', placeholder: '978…', 'aria-label': 'ISBN' });
    panneau.replaceChildren(el('p.meta', { texte: texteAide }), el('form', {
      onsubmit: (e) => { e.preventDefault(); trouve(champ.value.replace(/\D/g, '')); },
    }, el('div.recherche', {}, champ, el('button.bouton', { texte: T.chercher }))));
  };

  async function trouve(isbn) {
    if (fini) return;
    fini = true;
    flux?.getTracks().forEach((t) => t.stop());
    navigator.vibrate?.(40);
    panneau.replaceChildren(el('p.meta', { texte: `ISBN ${isbn}…` }));
    let livre = null;
    try { livre = await api(`isbn/${isbn}`); } catch { /* inconnu : choix à la main */ }
    let series;
    try { series = await api('series'); } catch (x) { // 18/11 : réseau coupé → message + Réessayer, l'ISBN est gardé
      panneau.replaceChildren(el('p.erreur', { role: 'alert', texte: `${x.message} (ISBN ${isbn})` }),
        el('button.bouton.or', { type: 'button', texte: T.reessayer, onclick: () => { fini = false; trouve(isbn); } }));
      return;
    }
    resultat(isbn, livre, series);
  }

  function resultat(isbn, livre, series) {
    // 18/11 : la liste de toutes les séries se filtre en tapant (recherche sans accents)
    const nouvelle = () => el('option', { value: '', texte: `+ ${T.nouvelleSerie}${livre?.serie_titre && !livre.serie_id ? ` : ${livre.serie_titre}` : ''}` });
    const choix = el('select', { name: 'serie', id: 'scan-serie' }, nouvelle(),
      ...series.map((s) => el('option', { value: String(s.id), selected: s.id === livre?.serie_id, texte: s.titre })));
    const filtre = el('input', { type: 'search', id: 'scan-filtre', autocomplete: 'off', oninput: () => {
      const t = sansAccents(filtre.value.trim()), garde = choix.value;
      const l = series.filter((s) => !t || sansAccents(`${s.titre} ${s.alias || ''}`).includes(t));
      choix.replaceChildren(nouvelle(), ...l.map((s) => el('option', { value: String(s.id), texte: s.titre })));
      choix.value = l.some((s) => String(s.id) === garde) ? garde : t && l.length ? String(l[0].id) : '';
      choix.dispatchEvent(new Event('change'));
    } });
    const titre = el('input', { value: livre?.serie_titre || '', id: 'scan-titre' });
    const champTitre = el('label.champ', { for: 'scan-titre' }, el('span', { texte: T.titreNouvelle }), titre);
    const num = el('input', { type: 'number', min: '1', max: '999', value: livre?.numero ? String(livre.numero) : '', required: true, 'aria-label': T.numero });
    // saisons (04/11) : champ visible quand le livre en indique une ou que la série choisie en a déjà
    const saison = el('input', { type: 'number', min: '1', max: '99', value: livre?.saison ? String(livre.saison) : '', placeholder: '1', 'aria-label': 'Saison' });
    const champSaison = el('label.champ', {}, el('span', { texte: 'Saison' }), saison);
    const majSaison = () => {
      const s = series.find((x) => String(x.id) === choix.value);
      champSaison.hidden = !(livre?.saison || (s && s.saisons));
    };
    const type = el('select', { id: 'scan-type' }, ...Object.entries(T.types).map(([k, v]) => el('option', { value: k, selected: k === (livre?.type_suggere || 'manga'), texte: v })));
    const champType = el('label.champ', { for: 'scan-type' }, el('span', { texte: T.type }), type);
    const envie = el('button.bouton.discret', { type: 'submit', value: 'envie', texte: T.envie });
    const majTitre = () => { champTitre.hidden = !!choix.value; champType.hidden = !!choix.value; envie.hidden = !!choix.value; panneau.querySelectorAll('p.aide').forEach((a) => { a.hidden = !!choix.value; }); };
    choix.addEventListener('change', () => { majTitre(); majSaison(); }); saison.addEventListener('input', majSaison); majTitre(); majSaison();
    panneau.replaceChildren(
      el('p.meta', { texte: livre?.titre ? [livre.titre, livre.auteur, livre.editeur, `ISBN ${isbn}`].filter(Boolean).join(' · ') : livre?.serie_id ? `${livre.serie_titre} · tome ${livre.numero} (reconnu grâce à ta bibliothèque) · ISBN ${isbn}` : T.scanInconnu(isbn) }),
      livre?.deja_possede ? el('p', { texte: T.dejaPossede }) : '',
      el('form', {
        onsubmit: async (e) => {
          e.preventDefault();
          if (!choix.value && !titre.value.trim()) { message('Indique le titre de la nouvelle série.'); titre.focus(); return; }
          const bouton = e.submitter || e.currentTarget.querySelector('button[type="submit"]');
          const pourEnvie = bouton.value === 'envie' && !choix.value;
          bouton.disabled = true;
          try {
            const r = await api('achat', { method: 'POST', corps: {
              serie_id: choix.value ? Number(choix.value) : null, titre: titre.value.trim(), type: type.value, numero: Number(num.value), saison: Number(saison.value) || 1, isbn, envie: pourEnvie,
              livre: livre ? { titre: livre.titre, serie: livre.serie_lue, editeur: livre.editeur, auteur: livre.auteur, pages: livre.pages,
                date: livre.date, resume: livre.resume, couverture: livre.couverture } : null,
            } });
            message(pourEnvie ? T.envieNotee(titre.value.trim()) : T.achatNote(choix.value ? choix.selectedOptions[0].textContent : titre.value, num.value));
            fermer();
            if (location.hash === `#/serie/${r.serie_id}`) apres?.(); else location.hash = `#/serie/${r.serie_id}`;
          } catch (x) {
            erreur(x); // le panneau reste ouvert : rien n'est perdu
            bouton.disabled = false;
          }
        },
      },
      series.length > 8 ? el('label.champ', { for: 'scan-filtre' }, el('span', { texte: T.filtrerSeries }), filtre) : '',
      el('label.champ', { for: 'scan-serie' }, el('span', { texte: T.serie }), choix), champTitre, champType,
      champSaison, el('label.champ', {}, el('span', { texte: T.numero }), num),
      el('p.aide', { texte: T.aideNouvelleSerie, hidden: !!livre?.serie_id }),
      el('button.bouton.or', { type: 'submit', texte: T.noterAchat }), envie, el('p.aide', { texte: T.aideEnvie, hidden: !!livre?.serie_id })));
    (livre?.numero ? panneau.querySelector('button') : num).focus();
  }

  // iPhone (Safari) n'a pas de lecteur de code-barres : la version libre embarque zxing (/vendor/code-barres.js, construit par libre/construire.mjs)
  let Detecteur = window.BarcodeDetector;
  // (18/11) seulement dans la version libre : chez Olivier le fichier n'existe pas (404 dans la console)
  if (!Detecteur && document.documentElement.hasAttribute('data-libre')) try { Detecteur = (await import('/vendor/code-barres.js')).BarcodeDetector; } catch { /* absent */ }
  const sansCamera = () => { ecran.classList.add('sans-camera'); saisieManuelle(T.scanSansCamera); panneau.querySelector('input').focus(); }; // pas de viseur animé sur un écran noir
  if (!Detecteur || !navigator.mediaDevices?.getUserMedia) return sansCamera();
  saisieManuelle(T.scanViser);
  try {
    flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    video.srcObject = flux;
    await video.play();
    const detecteur = new Detecteur({ formats: ['ean_13'] }); // un ISBN-13 est un EAN-13 (978/979…)
    const boucle = async () => {
      if (fini) return;
      try {
        const codes = await detecteur.detect(video);
        const isbn = codes.map((c) => c.rawValue).find((v) => /^97[89]\d{10}$/.test(v));
        if (isbn) return trouve(isbn);
      } catch { /* image pas prête */ }
      setTimeout(boucle, 180);
    };
    boucle();
  } catch {
    sansCamera();
  }
}
