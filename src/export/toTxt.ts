import { unified } from 'unified';
import remarkParse from 'remark-parse';
import type { Root, RootContent, PhrasingContent } from 'mdast';

/**
 * Convierte el Markdown de la novela a texto plano.
 *  - H1: dos líneas vacías antes (salvo al inicio), título en su línea.
 *  - H2+: una línea vacía antes.
 *  - Separadores: "* * *".
 *  - Énfasis: texto sin marcadores.
 */
export function markdownToTxt(md: string): string {
  const tree = unified().use(remarkParse).parse(md) as Root;
  const blocks: string[] = [];

  for (const node of tree.children) {
    const text = renderBlock(node);
    if (text === null) continue;
    if (node.type === 'heading' && node.depth === 1 && blocks.length > 0) blocks.push('');
    blocks.push(text);
  }

  return blocks.join('\n\n').replace(/\n{4,}/g, '\n\n\n').trimEnd() + '\n';
}

function renderBlock(node: RootContent): string | null {
  switch (node.type) {
    case 'heading':
      return inline(node.children);
    case 'paragraph':
      return inline(node.children);
    case 'thematicBreak':
      return '* * *';
    case 'blockquote':
      return node.children.map((c) => renderBlock(c)).filter((s): s is string => s !== null).join('\n\n');
    case 'list':
      return node.children
        .map((item) => item.children.map((c) => renderBlock(c)).filter((s): s is string => s !== null).join('\n'))
        .join('\n');
    case 'code':
      return node.value;
    case 'html':
      return null;
    default:
      return 'children' in node ? inline(node.children as PhrasingContent[]) : null;
  }
}

function inline(children: PhrasingContent[]): string {
  return children
    .map((c): string => {
      switch (c.type) {
        case 'text':
          return c.value;
        case 'inlineCode':
          return c.value;
        case 'break':
          return '\n';
        case 'image':
          return c.alt ?? '';
        case 'emphasis':
        case 'strong':
        case 'delete':
        case 'link':
        case 'linkReference':
          return inline(c.children);
        default:
          return 'children' in c ? inline((c as { children: PhrasingContent[] }).children) : '';
      }
    })
    .join('');
}
