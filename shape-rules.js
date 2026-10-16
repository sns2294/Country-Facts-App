// Shared by the globe (3D) and the flat map so both treat map shapes alike.
//
// How map shapes that don't match a country in countries.json (breakaway or
// disputed regions in the Natural Earth data) are handled. Keyed by the
// shape's name in the map data. The rule, applied the same way to any shape
// added later:
//   1. A shape with its own fact card (an entry in countries.json) stays a
//      separate shape, linked to that entry: `linkTo` is the entry's alpha2.
//   2. A shape with no entry merges into the UN-recognized country it belongs
//      to: `mergeInto` is that country's alpha2. The shared border is
//      dissolved so the pair highlights, hovers and clicks as one country.
//   3. A disputed shape the UN hasn't settled stays neutral: `neutral` shapes
//      are not clickable, highlighted or labelled.
// Overseas territories split out of their parent country's shape by
// scripts/split-territories.mjs (Natural Earth draws them inside France, Norway
// and the Netherlands) are rule 1 as well: they keep their own shape, linked to
// their entry.
// Shapes not listed here (e.g. "Indian Ocean Ter.") are left as the map data
// has them. Territories that already have an entry (Greenland, Taiwan, ...)
// keep their own shape too, per rule 1.
window.SHAPE_RULES = {
  "N. Cyprus": { mergeInto: "CY" }, // Cyprus
  Somaliland: { mergeInto: "SO" }, // Somalia
  Kosovo: { linkTo: "XK" }, // "Republic of Kosovo" entry; not in the quiz (not sovereign)
  "French Guiana": { linkTo: "GF" },
  Guadeloupe: { linkTo: "GP" },
  Martinique: { linkTo: "MQ" },
  "Réunion": { linkTo: "RE" },
  Mayotte: { linkTo: "YT" },
  "Svalbard and Jan Mayen": { linkTo: "SJ" },
  "Bonaire, Sint Eustatius and Saba": { linkTo: "BQ" },
  "Siachen Glacier": { neutral: true }, // claimed by India and Pakistan
};
