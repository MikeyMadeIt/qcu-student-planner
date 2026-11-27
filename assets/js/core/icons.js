/* Local Lucide sprite renderer for static and JavaScript-generated icons. */
(function () {
    const scriptUrl = document.currentScript && document.currentScript.src
        ? document.currentScript.src
        : new URL('assets/js/core/icons.js', document.baseURI).href;
    const spriteUrl = new URL('../../icons/lucide-sprite.svg', scriptUrl).href;
    const SVG_NS = 'http://www.w3.org/2000/svg';

    function iconName(element) {
        const iconClass = Array.from(element.classList).find(name => name.startsWith('icon-lucide-'));
        return iconClass ? iconClass.slice('icon-lucide-'.length) : (element.getAttribute('data-lucide') || '');
    }

    function render(element) {
        if (!(element instanceof Element)) return;
        const name = iconName(element);
        if (!name) return;

        if (element instanceof SVGElement && element.classList.contains('lucide-icon')) {
            if (element.getAttribute('data-lucide') !== name) element.setAttribute('data-lucide', name);
            const use = element.querySelector('use');
            if (use) {
                const href = `${spriteUrl}#${name}`;
                if (use.getAttribute('href') !== href) {
                    use.setAttribute('href', href);
                    use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', href);
                }
            }
            return;
        }

        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('class', `${element.className || ''} lucide-icon`.replace(/\s+/g, ' ').trim());
        svg.setAttribute('data-lucide', name);
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.setAttribute('aria-hidden', element.getAttribute('aria-hidden') || 'true');
        for (const attribute of Array.from(element.attributes)) {
            if (['class', 'data-lucide', 'aria-hidden'].includes(attribute.name)) continue;
            if (attribute.name.startsWith('on')) continue;
            svg.setAttribute(attribute.name, attribute.value);
        }

        const use = document.createElementNS(SVG_NS, 'use');
        const href = `${spriteUrl}#${name}`;
        use.setAttribute('href', href);
        use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', href);
        svg.appendChild(use);
        element.replaceWith(svg);
    }

    function renderTree(root) {
        if (root.matches && root.matches('i[data-lucide], i[class*="icon-lucide-"]')) render(root);
        root.querySelectorAll?.('i[data-lucide], i[class*="icon-lucide-"], svg.lucide-icon[data-lucide]')
            .forEach(render);
    }

    const observer = new MutationObserver(records => {
        for (const record of records) {
            if (record.type === 'attributes') {
                if (record.target.matches('svg.lucide-icon[data-lucide]')) render(record.target);
                continue;
            }
            record.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) renderTree(node);
            });
        }
    });
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'data-lucide'],
    });

    window.setLucideIcon = function (element, name) {
        if (!element) return;
        name = String(name || '').replace(/^icon-lucide-/, '');
        if (element.classList) {
            Array.from(element.classList).filter(value => value.startsWith('icon-lucide-'))
                .forEach(value => element.classList.remove(value));
            element.classList.add(`icon-lucide-${name}`);
            if (element instanceof SVGElement) element.classList.add('lucide-icon');
        }
        element.setAttribute('data-lucide', name);
        render(element);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => renderTree(document), { once: true });
    } else {
        renderTree(document);
    }
})();
