// ==UserScript==
// @name         NodeSeek 自动屏蔽黑名单用户通知
// @namespace    local.nodeseek
// @version      2.0
// @description  自动读取 NodeSeek 官方黑名单，隐藏对应用户的艾特、回复和私聊通知
// @match        https://www.nodeseek.com/*
// @match        https://nodeseek.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    const LIST_API = '/api/block-list/list';
    const CACHE_KEY = 'ns_official_blocklist_cache_v2';
    const REFRESH_INTERVAL = 5 * 60 * 1000;

    let blockedNames = new Set();
    let blockedIds = new Set();
    let scanPending = false;

    function normalizeName(value) {
        return String(value || '')
            .trim()
            .replace(/^@/, '')
            .replace(/\s+/g, ' ')
            .toLowerCase();
    }

    function normalizeId(value) {
        const id = String(value || '').trim();
        return /^\d+$/.test(id) ? id : '';
    }

    function saveCache() {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                names: [...blockedNames],
                ids: [...blockedIds],
                time: Date.now()
            }));
        } catch (error) {
            console.warn('[NS黑名单] 缓存保存失败：', error);
        }
    }

    function loadCache() {
        try {
            const cache = JSON.parse(
                localStorage.getItem(CACHE_KEY) || '{}'
            );

            if (Array.isArray(cache.names)) {
                blockedNames = new Set(cache.names);
            }

            if (Array.isArray(cache.ids)) {
                blockedIds = new Set(cache.ids);
            }
        } catch (error) {
            console.warn('[NS黑名单] 缓存读取失败：', error);
        }
    }

    function getListFromResponse(json) {
        const candidates = [
            json?.data,
            json?.result?.data,
            json?.result,
            json?.data?.list,
            json?.list,
            json
        ];

        return candidates.find(Array.isArray) || [];
    }

    async function syncOfficialBlocklist() {
        try {
            const response = await fetch(LIST_API, {
                method: 'GET',
                credentials: 'include',
                cache: 'no-store',
                headers: {
                    Accept: 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const json = await response.json();

            if (json?.success === false) {
                throw new Error(json.message || '接口返回失败');
            }

            const list = getListFromResponse(json);
            const newNames = new Set();
            const newIds = new Set();

            for (const item of list) {
                const name = normalizeName(
                    item?.block_member_name ??
                    item?.member_name ??
                    item?.username ??
                    item?.user_name ??
                    item?.name
                );

                const id = normalizeId(
                    item?.block_member_id ??
                    item?.member_id ??
                    item?.user_id ??
                    item?.id
                );

                if (name) newNames.add(name);
                if (id) newIds.add(id);
            }

            blockedNames = newNames;
            blockedIds = newIds;
            saveCache();

            console.log(
                `[NS黑名单] 已同步：${blockedNames.size} 个用户名，` +
                `${blockedIds.size} 个用户 ID`
            );

            restoreHiddenRows();
            scanNotifications();
        } catch (error) {
            console.warn(
                '[NS黑名单] 官方名单同步失败，继续使用本地缓存：',
                error
            );
        }
    }

    function getPossibleRows(element) {
        const rows = [];
        let current = element;

        for (
            let depth = 0;
            depth < 9 && current && current !== document.body;
            depth++
        ) {
            if (
                current.matches(
                    'li, article, tr, [role="listitem"],' +
                    '[class*="notification-item"],' +
                    '[class*="message-item"],' +
                    '[class*="notice-item"],' +
                    '[class*="list-item"]'
                )
            ) {
                rows.push(current);
            }

            const height = current.getBoundingClientRect().height;
            const textLength = (current.innerText || '').trim().length;
            const parent = current.parentElement;

            if (
                parent &&
                parent.children.length > 1 &&
                height >= 25 &&
                height <= 350 &&
                textLength > 0 &&
                textLength <= 1000
            ) {
                rows.push(current);
            }

            current = parent;
        }

        return [...new Set(rows)];
    }

    function matchesBlockedName(text) {
        const candidate = normalizeName(text);
        if (!candidate) return false;

        for (const name of blockedNames) {
            if (
                candidate === name ||
                candidate.startsWith(`${name} `) ||
                candidate.startsWith(`${name}\n`)
            ) {
                return true;
            }
        }

        return false;
    }

    function linkMatchesBlockedUser(link) {
        if (matchesBlockedName(link.textContent)) {
            return true;
        }

        const rawHref = link.getAttribute('href');
        if (!rawHref) return false;

        try {
            const url = new URL(rawHref, location.origin);

            const possibleNames = [
                url.searchParams.get('username'),
                url.searchParams.get('user'),
                url.searchParams.get('name')
            ];

            if (possibleNames.some(matchesBlockedName)) {
                return true;
            }

            const to = url.searchParams.get('to');

            if (
                matchesBlockedName(to) ||
                blockedIds.has(normalizeId(to))
            ) {
                return true;
            }

            const profileMatch = decodeURIComponent(url.pathname).match(
                /\/(?:space|user|member)\/([^/?#]+)/i
            );

            if (
                profileMatch &&
                matchesBlockedName(profileMatch[1])
            ) {
                return true;
            }
        } catch {
            // 无效链接直接忽略
        }

        return false;
    }

    function rowMatchesBlockedUser(row) {
        return [...row.querySelectorAll('a[href]')]
            .some(linkMatchesBlockedUser);
    }

    function isNotificationContext(row) {
        if (location.pathname.startsWith('/notification')) {
            return true;
        }

        if (
            row.closest(
                '[class*="notification"],' +
                '[class*="Notification"],' +
                '[class*="notice"],' +
                '[class*="Notice"],' +
                '[role="menu"],' +
                '[role="listbox"]'
            )
        ) {
            return true;
        }

        const text = row.innerText || '';

        return /@你|艾特|提及|回复了你|评论了你|私信|私聊|发来.*消息|mentioned|replied|message/i
            .test(text);
    }

    function hideRow(row) {
        row.style.setProperty('display', 'none', 'important');
        row.dataset.nsOfficialBlocked = '1';
    }

    function restoreHiddenRows() {
        document
            .querySelectorAll('[data-ns-official-blocked="1"]')
            .forEach(row => {
                row.style.removeProperty('display');
                delete row.dataset.nsOfficialBlocked;
            });
    }

    function scanNotifications() {
        if (!blockedNames.size && !blockedIds.size) return;

        document.querySelectorAll('a[href]').forEach(link => {
            if (!linkMatchesBlockedUser(link)) return;

            const rows = getPossibleRows(link);

            for (const row of rows) {
                if (!isNotificationContext(row)) continue;
                if (!rowMatchesBlockedUser(row)) continue;

                hideRow(row);
                break;
            }
        });
    }

    function scheduleScan() {
        if (scanPending) return;

        scanPending = true;

        requestAnimationFrame(() => {
            scanPending = false;
            scanNotifications();
        });
    }

    loadCache();
    scanNotifications();
    syncOfficialBlocklist();

    new MutationObserver(scheduleScan).observe(document.body, {
        childList: true,
        subtree: true
    });

    setInterval(syncOfficialBlocklist, REFRESH_INTERVAL);

    window.addEventListener('focus', syncOfficialBlocklist);
    window.addEventListener('hashchange', scheduleScan);
    window.addEventListener('popstate', scheduleScan);
})();
