/** Give wide Markdown content accessible, keyboard-scrollable boundaries at build time. */
export default function readingSurfaces() {
  return (tree) => {
    let heading = 'Documentation';
    function textOf(node) {
      return node.type === 'text' ? node.value : (node.children || []).map(textOf).join('');
    }
    function visit(node) {
      if (!node.children) return;
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (child.type === 'element' && /^h[2-4]$/.test(child.tagName)) heading = textOf(child);
        if (child.type === 'element' && child.tagName === 'table') {
          node.children[i] = {
            type: 'element', tagName: 'div',
            properties: { className: ['table-scroll'], tabIndex: 0, role: 'region', ariaLabel: heading },
            children: [child],
          };
        } else {
          if (child.type === 'element' && child.tagName === 'pre') {
            child.properties ||= {};
            child.properties.tabIndex = 0;
            child.properties.ariaLabel = `${heading} code example`;
          }
          visit(child);
        }
      }
    }
    visit(tree);
  };
}
