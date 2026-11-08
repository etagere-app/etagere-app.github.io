// Saisons d'une série (04/11, demande d'Olivier : « Hajime no Ippo » a plusieurs saisons, chacune repart au tome 1).
// En base, les tomes gardent un numéro CONTINU (saison 2 tome 1 = le tome qui suit le dernier de la saison 1) ; la série
// note seulement où commence chaque saison : series.saisons = « 2:31|3:58 » (saison:1er numéro continu). Sans saisons :
// rien ne change. Source unique : importé par l'appli (public/) et par le Worker (worker/).

// « 2:31|3:58 » → [{ saison: 1, debut: 1 }, { saison: 2, debut: 31 }, { saison: 3, debut: 58 }]
export function lireSaisons(texte) {
  const autres = String(texte || '').split('|').map((x) => x.split(':').map(Number))
    .filter(([s, d]) => Number.isInteger(s) && s > 1 && Number.isInteger(d) && d >= 1).map(([saison, debut]) => ({ saison, debut }));
  return [{ saison: 1, debut: 1 }, ...autres].sort((a, b) => a.debut - b.debut || a.saison - b.saison);
}

export const ecrireSaisons = (liste) => liste.filter((s) => s.saison > 1).sort((a, b) => a.debut - b.debut || a.saison - b.saison).map((s) => `${s.saison}:${s.debut}`).join('|') || null;

// Numéro continu → { saison, numero } (numero dans la saison)
export function versLocal(saisons, n) {
  const l = Array.isArray(saisons) ? saisons : lireSaisons(saisons);
  const s = [...l].reverse().find((x) => n >= x.debut) || l[0];
  return { saison: s.saison, numero: n - s.debut + 1 };
}

// { saison, numero } → numéro continu ; null si la saison n'est pas encore connue de la série
export function versGlobal(saisons, saison, numero) {
  const l = Array.isArray(saisons) ? saisons : lireSaisons(saisons);
  const s = l.find((x) => x.saison === (saison || 1));
  return s ? s.debut + numero - 1 : null;
}

// Nouvelle saison : elle commence après le dernier tome connu (dernier = plus grand numéro continu, 0 = aucun tome).
// 04/11 (Olivier : « ne me demande pas combien de tomes par saison ») : une nouvelle série scannée en saison 2 commence
// au tome 1 (saison 1 vide pour l'instant) ; l'automate donne ensuite les vraies longueurs et les tomes sont renumérotés.
export function ajouterSaison(texte, saison, dernier) {
  const l = lireSaisons(texte);
  if (saison <= 1 || l.some((x) => x.saison === saison)) return ecrireSaisons(l);
  const der = l[l.length - 1];
  return ecrireSaisons([...l, { saison, debut: Math.max((dernier || 0) + 1, der.saison > 1 ? der.debut + 1 : 1) }]);
}

// Longueurs données par l'automate [{ saison: 1, tomes: 30 }, { saison: 2, tomes: 16 }…] → « 2:31|3:47… » (null si invalide)
export function depuisLongueurs(longueurs) {
  const l = (Array.isArray(longueurs) ? longueurs : []).map((x) => ({ saison: Number(x?.saison), tomes: Number(x?.tomes) }))
    .filter((x) => Number.isInteger(x.saison) && x.saison >= 1 && x.saison <= 99 && Number.isInteger(x.tomes) && x.tomes >= 1 && x.tomes <= 999)
    .sort((a, b) => a.saison - b.saison);
  if (l.length < 2 || l[0].saison !== 1 || l.some((x, i) => x.saison !== i + 1)) return null; // saisons 1, 2, 3… sans trou
  let debut = 1;
  return ecrireSaisons(l.map((x) => { const s = { saison: x.saison, debut }; debut += x.tomes; return s; }));
}

// Saison 1 pas encore connue (une saison 2+ commence au tome 1) : l'automate doit donner les longueurs
export const saisonsIncompletes = (texte) => lireSaisons(texte).some((x) => x.saison > 1 && x.debut === 1);

export const aDesSaisons = (texte) => lireSaisons(texte).length > 1;

// Noms des saisons/arcs (séparés de la numérotation, que l'automate reconstruit) : JSON { "1": "Aincrad", "2": "Fairy Dance" }.
export function lireNoms(v) {
  if (v && typeof v === 'object') return v;
  try { const o = JSON.parse(v || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; }
}
export const nomSaison = (noms, saison) => { const o = lireNoms(noms); return o[saison] || o[String(saison)] || null; };
export function ecrireNoms(obj) {
  const net = {};
  for (const [k, val] of Object.entries(lireNoms(obj))) {
    const s = Number(k), nom = String(val || '').replace(/[|:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (Number.isInteger(s) && s >= 1 && s <= 99 && nom) net[s] = nom;
  }
  return Object.keys(net).length ? JSON.stringify(net) : null;
}

// « Tome 5 », « Saison 2 · tome 5 », ou « Aincrad · tome 5 » si la saison porte un nom (noms = series.saisons_noms).
export function libelleTome(texte, n, noms) {
  if (!aDesSaisons(texte)) return `Tome ${n}`;
  const { saison, numero } = versLocal(texte, n);
  return `${nomSaison(noms, saison) || `Saison ${saison}`} · tome ${numero}`;
}
