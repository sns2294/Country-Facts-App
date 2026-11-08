// The regional maps in the order the "More maps" hub (/maps/) lists them. Shared by the pages that link to them:
//   scripts/build-pages.mjs        the hub page, the nav and the country pages' map links
//   scripts/build-map-thumbs.mjs   the hub's card thumbnails, drawn from each map's own page
// The maps themselves come from scripts/build-maps.mjs (one page per id, maps/<id>/index.html).
// `name` is the short name used on cards and in "See Germany on the Europe map"; `blurb` is the one-line card description.
export const MAP_REGIONS = [
  { id: "europe", name: "Europe", blurb: "From Iceland to Russia, with the smallest states labeled by pointer lines." },
  { id: "africa", name: "Africa", blurb: "All 54 countries plus Western Sahara, with the island nations labeled." },
  { id: "middle-east", name: "Middle East", blurb: "From Turkey to Yemen and Egypt to the Caucasus, with an inset of the Levant." },
  { id: "central-asia", name: "Central Asia", blurb: "Kazakhstan, Uzbekistan, Turkmenistan, Kyrgyzstan, Tajikistan and Afghanistan." },
  { id: "south-asia", name: "South Asia", blurb: "India and its neighbors, with Kashmir shown as a disputed area." },
  { id: "east-asia", name: "East Asia", blurb: "China, Japan, Mongolia, the Koreas and Taiwan, with disputed islands marked." },
  { id: "southeast-asia", name: "Southeast Asia", blurb: "From Myanmar to Timor-Leste, with South China Sea islands marked as disputed." },
  { id: "north-america", name: "North America", blurb: "Canada, the United States and Mexico, with an inset of Hawaii." },
  { id: "central-america-caribbean", name: "Central America and the Caribbean", blurb: "The isthmus and the islands, with an inset of the Lesser Antilles." },
  { id: "south-america", name: "South America", blurb: "The 12 countries, plus French Guiana and the Falklands, with a Galápagos inset." },
  { id: "oceania", name: "Oceania", blurb: "Australia, New Zealand and the Pacific islands, drawn across the 180° line." },
];
