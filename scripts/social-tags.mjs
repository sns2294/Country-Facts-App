// The Open Graph and Twitter card tags every page carries, shared by scripts/build-pages.mjs (the country pages, the hub,
// index.html) and scripts/build-maps.mjs (the regional maps) so they cannot drift apart.
// `image` is a path from the site root to a 1200x630 preview image (og/<name>.png).
export const OG_W = 1200;
export const OG_H = 630;

const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const socialTags = ({ baseUrl, siteName, title, description, image }) => {
  const url = `${baseUrl}/${image}`;
  return [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${siteName}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:image" content="${url}" />`,
    `<meta property="og:image:width" content="${OG_W}" />`,
    `<meta property="og:image:height" content="${OG_H}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    `<meta name="twitter:image" content="${url}" />`,
  ].join("\n  ");
};
