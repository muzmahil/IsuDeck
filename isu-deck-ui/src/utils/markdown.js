import { marked } from 'marked';

/**
 * Release notes, plugin READMEs and other trusted-ish remote text arrive as
 * Markdown. `marked` turns them into HTML, but that HTML is not safe on its own
 * (a release body can contain raw script tags), so everything is run through a
 * conservative allow-list sanitizer before it reaches the DOM.
 */

const BLOCKED_TAGS = [
  'SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'SVG',
  'AUDIO', 'VIDEO', 'CANVAS', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA',
  'SELECT', 'OPTION', 'HEAD', 'BODY', 'HTML'
];

const BASE_TAGS = [
  'P', 'I', 'SPAN', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'B', 'STRONG', 'EM',
  'U', 'BR', 'DIV', 'HR', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'CODE', 'PRE',
  'DEL', 'S'
];

const RICH_TAGS = [...BASE_TAGS, 'A', 'IMG', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD'];

const BASE_ATTRS = ['class'];
const RICH_ATTRS = [...BASE_ATTRS, 'src', 'alt', 'href', 'target', 'title'];

/**
 * Strip anything that is not explicitly allowed.
 *
 * @param {string} html Markdown output.
 * @param {{ rich?: boolean }} options `rich` also allows links, images and tables.
 */
export const sanitizeHtml = (html, { rich = true } = {}) => {
  if (!html) return '';
  if (typeof window === 'undefined') return '';
  const allowedTags = rich ? RICH_TAGS : BASE_TAGS;
  const allowedAttrs = rich ? RICH_ATTRS : BASE_ATTRS;

  const doc = new DOMParser().parseFromString(String(html), 'text/html');

  const clean = (node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType !== 1) continue;
      const tagName = child.tagName;

      if (!allowedTags.includes(tagName)) {
        if (BLOCKED_TAGS.includes(tagName)) {
          child.remove();
        } else {
          clean(child);
          while (child.firstChild) {
            node.insertBefore(child.firstChild, child);
          }
          child.remove();
        }
        continue;
      }

      for (const attr of Array.from(child.attributes)) {
        const name = attr.name.toLowerCase();
        if (!allowedAttrs.includes(name)) {
          child.removeAttribute(attr.name);
        }
      }

      // Only http(s) and mailto links, and only inline data/http(s) images.
      if (tagName === 'A') {
        const href = (child.getAttribute('href') || '').trim();
        if (!/^(https?:|mailto:)/i.test(href)) {
          child.removeAttribute('href');
        } else {
          child.setAttribute('target', '_blank');
          child.setAttribute('rel', 'noreferrer noopener');
        }
      }
      if (tagName === 'IMG') {
        const src = (child.getAttribute('src') || '').trim();
        if (!/^(https?:|data:image\/)/i.test(src)) {
          child.remove();
          continue;
        }
      }

      clean(child);
    }
  };

  clean(doc.body);
  return doc.body.innerHTML;
};

/**
 * Render Markdown into sanitized HTML.
 *
 * @param {string} markdown Source text.
 * @param {{ rich?: boolean }} options Forwarded to `sanitizeHtml`.
 */
export const renderMarkdown = (markdown, options = {}) => {
  if (!markdown) return '';
  try {
    return sanitizeHtml(marked.parse(String(markdown)), options);
  } catch {
    // Fall back to escaped plain text so a malformed body still shows up.
    return sanitizeHtml(
      String(markdown)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>'),
      options
    );
  }
};

export default renderMarkdown;
