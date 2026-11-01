// ==UserScript==
// @name         NodeSeek 用户发帖与评论频率
// @namespace    nodeseek-user-frequency
// @version      1.1.0
// @description  在用户主页的主题帖数、评论数目下方显示日均频率。
// @match        https://www.nodeseek.com/space/*
// @match        https://nodeseek.com/space/*
// @run-at       document-idle
// @grant        none
// @noframes
// @license      MIT
// ==/UserScript==

(() => {
    'use strict';

    const root = document.querySelector('#nsk-frame') || document.body;
    const number = node => {
        const text = (node?.textContent || '').replace(/[,，\s]/g, '');
        return /^\d+$/.test(text) ? Number(text) : NaN;
    };

    function update() {
        const cards = new Map([...root.querySelectorAll('.card-block .card-item')]
            .map(card => [card.querySelector('.name')?.textContent.trim(), card]));
        const days = number(cards.get('加入天数')?.querySelector('.value'));

        for (const [label, unit] of [['主题帖数', '帖'], ['评论数目', '条']]) {
            const card = cards.get(label);
            if (!card) continue;
            const value = card.querySelector('.value');
            const total = number(value);
            let line = card.querySelector('.nsuf-frequency');

            if (!Number.isFinite(days) || !Number.isFinite(total)) {
                line?.remove();
                continue;
            }
            const rate = total / Math.max(1, days);
            const text = `日均 ${rate > 0 && rate < 0.01 ? '<0.01' : rate.toFixed(2)} ${unit}/天`;
            if (!line) {
                line = document.createElement('div');
                line.className = 'nsuf-frequency';
                line.style.cssText = 'margin-top:4px;font-size:12px;line-height:1.4;font-weight:normal;opacity:.7';
                value.after(line);
            }
            if (line.textContent !== text) line.textContent = text;
        }
    }

    let timer;
    new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(update, 100);
    }).observe(root, { childList: true, subtree: true, characterData: true });
    update();
})();
