// Deterministische Ampel-Logik. Die KI liefert nur Spannbreiten – die Einordnung passiert hier.

export type Stufe =
  | 'im_regionalen_rahmen'
  | 'leicht_ueber_vergleich'
  | 'auffaellig_hoch'
  | 'auffaellig_niedrig'
  | 'nicht_einordenbar';

// Grenzwerte (in Prozent relativ zur Grenze der Spannbreite)
export const TOLERANZ_UEBER_MAX = 10; // bis +10 % über Obergrenze: noch im Rahmen
export const GRENZE_AUFFAELLIG_HOCH = 30; // über +30 % über Obergrenze: auffällig hoch
export const GRENZE_AUFFAELLIG_NIEDRIG = 25; // mehr als 25 % unter Untergrenze: auffällig niedrig

export interface ClassifyInput {
  vergleichspreis: number | null; // Preis, der mit der Spannbreite verglichen wird (gleiche Basis)
  min: number | null;
  max: number | null;
}

export interface ClassifyResult {
  stufe: Stufe;
  abweichung_prozent: number | null; // Abweichung von der nächsten Grenze der Spannbreite
}

export function classify({ vergleichspreis, min, max }: ClassifyInput): ClassifyResult {
  if (vergleichspreis == null || !isFinite(vergleichspreis) || vergleichspreis <= 0) {
    return { stufe: 'nicht_einordenbar', abweichung_prozent: null };
  }
  if (min == null || max == null || !isFinite(min) || !isFinite(max) || min <= 0 || max <= 0) {
    return { stufe: 'nicht_einordenbar', abweichung_prozent: null };
  }
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);

  let abweichung = 0;
  if (vergleichspreis > hi) abweichung = ((vergleichspreis - hi) / hi) * 100;
  else if (vergleichspreis < lo) abweichung = ((vergleichspreis - lo) / lo) * 100;
  abweichung = Math.round(abweichung * 10) / 10;

  let stufe: Stufe = 'im_regionalen_rahmen';
  if (abweichung > GRENZE_AUFFAELLIG_HOCH) stufe = 'auffaellig_hoch';
  else if (abweichung > TOLERANZ_UEBER_MAX) stufe = 'leicht_ueber_vergleich';
  else if (abweichung < -GRENZE_AUFFAELLIG_NIEDRIG) stufe = 'auffaellig_niedrig';

  return { stufe, abweichung_prozent: abweichung };
}

const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Charta-konforme Textbausteine – defensiv, indikativ, mit Hinweis auf Regionalität und Datenbasis.
export function begruendung(
  stufe: Stufe,
  min: number | null,
  max: number | null,
  einheit: string | null,
  datenbasis: string,
): string {
  const spanne = min != null && max != null
    ? ` (beobachtete Spannbreite ca. ${fmt(Math.min(min, max))}–${fmt(Math.max(min, max))} €${einheit ? ' je ' + einheit : ''})`
    : '';
  const basis = ` Datenbasis: ${datenbasis}; die Einordnung ist indikativ und ersetzt keine fachliche Prüfung.`;
  switch (stufe) {
    case 'im_regionalen_rahmen':
      return `Der Preis liegt im regionalen Vergleich innerhalb der beobachteten Spannbreite vergleichbarer Positionen${spanne} und konnte nicht als auffällig eingeordnet werden.${basis}`;
    case 'leicht_ueber_vergleich':
      return `Der Preis liegt im regionalen Vergleich etwas oberhalb der beobachteten Spannbreite vergleichbarer Positionen${spanne}. Eine Rückfrage zum Leistungsumfang kann sinnvoll sein.${basis}`;
    case 'auffaellig_hoch':
      return `Der Preis liegt im regionalen Vergleich deutlich oberhalb der beobachteten Spannbreite vergleichbarer Positionen${spanne}. Möglicherweise sind besondere Umstände enthalten – eine Nachfrage beim Anbieter wird empfohlen.${basis}`;
    case 'auffaellig_niedrig':
      return `Der Preis liegt im regionalen Vergleich deutlich unterhalb der beobachteten Spannbreite vergleichbarer Positionen${spanne}. Es kann sinnvoll sein zu prüfen, ob alle Leistungen enthalten sind.${basis}`;
    default:
      return `Für diese Position konnte keine belastbare Einordnung vorgenommen werden (kein eindeutiger Preis oder keine Vergleichsbasis).${basis}`;
  }
}
