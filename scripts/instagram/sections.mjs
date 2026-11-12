// How each map becomes a carousel: slide 1 is the map cropped tight to the 4:5 frame, then zoomed sections where the labels are readable on a phone.
// Positions are fractions of the map's own viewBox: cx, cy = the centre, w = the width shown (the height follows from the frame's shape).
// `whole: true` shows the whole map (used where cropping would cut an inset or too much of a tall map). Edit here to change a crop.
export const VIEWS = {
  europe: { start: { cx: 0.47, cy: 0.5, w: 0.78 }, sections: [
    { name: "Western and Central Europe", cx: 0.43, cy: 0.64, w: 0.44 },
    { name: "The Balkans and Eastern Europe", cx: 0.75, cy: 0.72, w: 0.38 },
    { name: "Nordic and Baltic countries", cx: 0.5, cy: 0.28, w: 0.46 },
  ] },
  africa: { start: { cx: 0.5, cy: 0.5, w: 0.96 }, sections: [
    { name: "North and West Africa", cx: 0.27, cy: 0.27, w: 0.52 },
    { name: "East Africa and the Horn", cx: 0.72, cy: 0.42, w: 0.45 },
    { name: "Central and Southern Africa", cx: 0.6, cy: 0.74, w: 0.55 },
  ] },
  "middle-east": { start: { whole: true }, sections: [
    { name: "Turkey, Iraq and Iran", cx: 0.6, cy: 0.28, w: 0.62 },
    { name: "The Arabian Peninsula", cx: 0.6, cy: 0.62, w: 0.6 },
    { name: "The Levant", cx: 0.23, cy: 0.78, w: 0.46 },
  ] },
  "central-asia": { start: { cx: 0.5, cy: 0.5, w: 0.84 }, sections: [
    { name: "Uzbekistan and Turkmenistan", cx: 0.42, cy: 0.6, w: 0.5 },
    { name: "Kyrgyzstan, Tajikistan and Afghanistan", cx: 0.6, cy: 0.72, w: 0.5 },
  ] },
  "south-asia": { start: { whole: true }, sections: [
    { name: "The Himalayan north", cx: 0.5, cy: 0.25, w: 0.62 },
    { name: "Southern India and Sri Lanka", cx: 0.43, cy: 0.76, w: 0.5 },
  ] },
  "east-asia": { start: { cx: 0.6, cy: 0.5, w: 0.65 }, sections: [
    { name: "China and Mongolia", cx: 0.36, cy: 0.5, w: 0.56 },
    { name: "Japan and the Koreas", cx: 0.75, cy: 0.5, w: 0.42 },
  ] },
  "southeast-asia": { start: { cx: 0.5, cy: 0.5, w: 0.885 }, sections: [
    { name: "Mainland Southeast Asia", cx: 0.27, cy: 0.45, w: 0.5 },
    { name: "The Philippines, Borneo and Indonesia", cx: 0.7, cy: 0.6, w: 0.6 },
  ] },
  "north-america": { start: { whole: true }, sections: [
    { name: "Canada and Greenland", cx: 0.55, cy: 0.25, w: 0.8 },
    { name: "The United States and Mexico", cx: 0.52, cy: 0.7, w: 0.7 },
  ] },
  "central-america-caribbean": { start: { cx: 0.536, cy: 0.5, w: 0.927 }, sections: [
    { name: "Central America", cx: 0.27, cy: 0.78, w: 0.55 },
    { name: "Cuba, Jamaica and Hispaniola", cx: 0.56, cy: 0.65, w: 0.5 },
    { name: "The Lesser Antilles", cx: 0.75, cy: 0.27, w: 0.49 },
  ] },
  "south-america": { start: { whole: true }, sections: [
    { name: "Northern South America", cx: 0.42, cy: 0.24, w: 0.7 },
    { name: "The Southern Cone", cx: 0.38, cy: 0.74, w: 0.75 },
  ] },
  oceania: { start: { cx: 0.353, cy: 0.5, w: 0.705 }, sections: [
    { name: "Australia, New Zealand and Papua New Guinea", cx: 0.29, cy: 0.55, w: 0.58 },
    { name: "The Pacific Islands", cx: 0.6, cy: 0.5, w: 0.7 },
  ] },
  "population-density": { start: { whole: true }, sections: [
    { name: "The Americas", cx: 0.27, cy: 0.5, w: 0.53 },
    { name: "Europe and Africa", cx: 0.5, cy: 0.5, w: 0.53 },
    { name: "Asia and Oceania", cx: 0.75, cy: 0.5, w: 0.53 },
  ] },
};
