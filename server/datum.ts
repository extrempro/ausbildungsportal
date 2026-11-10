/** Heutiges Datum als JJJJ-MM-TT in lokaler Zeit des Servers (Zeitzone über TZ setzbar). */
export function heute(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
