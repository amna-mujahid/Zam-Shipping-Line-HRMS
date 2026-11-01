// Small value converters between MySQL rows and API shapes.
export const hm = (t) => (t ? String(t).slice(0, 5) : null); // 'HH:MM:SS' → 'HH:MM'
export const str = (v) => (v === null || v === undefined ? '' : String(v));
export const nullIfEmpty = (v) => (v === '' || v === undefined ? null : v);
export const json = (v) => (v === null || v === undefined ? null : JSON.stringify(v));
