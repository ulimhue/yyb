// ==UserScript==
// @name         应用宝 APK 直链下载
// @namespace    https://sj.qq.com
// @version      1.1
// @description  在应用宝网页版一键获取 APK 下载直链，无需安装应用宝客户端
// @author       opencode
// @match        https://sj.qq.com/appdetail/*
// @match        https://a.app.qq.com/o/simple.jsp*
// @icon         https://sj.qq.com/favicon.ico
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      upage.html5.qq.com
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    const PKG_REGEX = /[?&]pkgname=([^&]+)/;

    function getPackageName() {
        const m = window.location.pathname.match(/\/appdetail\/([^/]+)/);
        if (m) return m[1];
        const q = window.location.search.match(PKG_REGEX);
        if (q) return q[1];
        return null;
    }

    function formatBytes(bytes) {
        if (!bytes) return '';
        const n = parseInt(bytes, 10);
        if (isNaN(n)) return '';
        return (n / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function fetchAppDetail(pkgName) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: 'https://upage.html5.qq.com/wechat-apkinfo',
                responseType: 'json',
                data: JSON.stringify({ packagename: pkgName }),
                headers: { 'Content-Type': 'application/json' },
                onload: function (res) {
                    if (res.status !== 200) {
                        reject(new Error('请求失败，状态码: ' + res.status));
                        return;
                    }
                    try {
                        const data = parseApiResponse(res.response, pkgName);
                        resolve(data);
                    } catch (e) {
                        reject(new Error('解析数据失败: ' + e.message));
                    }
                },
                onerror: function () {
                    reject(new Error('网络请求失败'));
                },
                ontimeout: function () {
                    reject(new Error('请求超时'));
                }
            });
        });
    }

    function parseApiResponse(json, pkgName) {
        const records = json && json.app_detail_records;
        if (!records) throw new Error('未找到 app_detail_records');
        const app = records[pkgName];
        if (!app) throw new Error('未找到应用 ' + pkgName);
        const info = app.app_info || {};
        const apk = app.apk_all_data || {};
        const url = apk.url || '';
        if (!url) throw new Error('未找到下载链接');
        return {
            appName: info.name || '',
            packageName: info.package_name || '',
            versionName: apk.version_name || '',
            apkUrl: upgradeUrl(url),
            fileSize: apk.size_byte ? formatBytes(apk.size_byte) : '',
            apkMd5: apk.apk_md5 || '',
            author: info.author || ''
        };
    }

    function upgradeUrl(url) {
        return url && url.startsWith('http://') ? url.replace('http://', 'https://') : url;
    }

    function showDownloadDialog(info) {
        const existing = document.getElementById('yyb-direct-dl-dialog');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'yyb-direct-dl-dialog';
        overlay.innerHTML = `
<div style="
    position:fixed;inset:0;z-index:999999;
    display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,.45);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
">
    <div style="
        background:#fff;border-radius:12px;padding:28px 32px;
        min-width:420px;max-width:520px;box-shadow:0 8px 32px rgba(0,0,0,.18);
    ">
        <h3 style="margin:0 0 16px;font-size:18px;color:#121212;">📦 应用信息</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.8;">
            <tr><td style="color:#666;padding-right:12px;white-space:nowrap;vertical-align:top;">名称</td>
                <td style="color:#121212;word-break:break-all;">${escHtml(info.appName)}</td></tr>
            <tr><td style="color:#666;padding-right:12px;white-space:nowrap;vertical-align:top;">包名</td>
                <td style="color:#121212;word-break:break-all;font-family:monospace;">${escHtml(info.packageName)}</td></tr>
            <tr><td style="color:#666;padding-right:12px;white-space:nowrap;vertical-align:top;">版本</td>
                <td style="color:#121212;">${escHtml(info.versionName)}</td></tr>
            <tr><td style="color:#666;padding-right:12px;white-space:nowrap;vertical-align:top;">大小</td>
                <td style="color:#121212;">${escHtml(info.fileSize || '未知')}</td></tr>
            <tr><td style="color:#666;padding-right:12px;white-space:nowrap;vertical-align:top;">MD5</td>
                <td style="color:#121212;font-family:monospace;font-size:12px;">${escHtml(info.apkMd5 || '无')}</td></tr>
        </table>
        <div style="margin-top:16px;display:flex;gap:10px;justify-content:flex-end;">
            <button id="yyb-dl-cancel" style="
                padding:10px 20px;border:1px solid #d0d0d0;border-radius:8px;
                background:#f5f5f5;cursor:pointer;font-size:14px;
            ">取消</button>
            <button id="yyb-dl-confirm" style="
                padding:10px 24px;border:none;border-radius:8px;
                background:#07c160;color:#fff;cursor:pointer;font-size:14px;font-weight:600;
            ">⬇ 下载 APK</button>
        </div>
    </div>
</div>`;
        document.body.appendChild(overlay);

        document.getElementById('yyb-dl-cancel').onclick = function () { overlay.remove(); };
        document.getElementById('yyb-dl-confirm').onclick = function () {
            overlay.remove();
            window.open(info.apkUrl, '_blank');
        };
        overlay.onclick = function (e) {
            if (e.target === overlay) overlay.remove();
        };
    }

    function escHtml(s) {
        const el = document.createElement('span');
        el.textContent = s;
        return el.innerHTML;
    }

    function injectButton() {
        const existing = document.getElementById('yyb-direct-dl-btn');
        if (existing) return;

        const btn = document.createElement('div');
        btn.id = 'yyb-direct-dl-btn';
        btn.textContent = '⬇ 直接下载 APK';
        Object.assign(btn.style, {
            position: 'fixed',
            right: '20px',
            zIndex: '99999',
            padding: '12px 20px',
            background: 'linear-gradient(135deg, #07c160, #06ad56)',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(7,193,96,.35)',
            fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
            transition: 'transform .15s, box-shadow .15s',
            userSelect: 'none'
        });
        btn.onmouseenter = function () {
            btn.style.transform = 'translateY(-2px)';
            btn.style.boxShadow = '0 6px 20px rgba(7,193,96,.45)';
        };
        btn.onmouseleave = function () {
            btn.style.transform = '';
            btn.style.boxShadow = '0 4px 16px rgba(7,193,96,.35)';
        };
        btn.onclick = function () {
            const pkg = getPackageName();
            if (!pkg) {
                alert('无法获取应用包名');
                return;
            }
            btn.textContent = '⏳ 获取中...';
            btn.style.pointerEvents = 'none';
            fetchAppDetail(pkg).then(function (info) {
                if (!info.apkUrl) {
                    alert('未找到下载链接');
                    return;
                }
                showDownloadDialog(info);
            }).catch(function (err) {
                alert('获取失败: ' + err.message);
            }).finally(function () {
                btn.textContent = '⬇ 直接下载 APK';
                btn.style.pointerEvents = '';
            });
        };
        document.body.appendChild(btn);
    }

    function handleDirectPage() {
        if (window.location.hostname === 'a.app.qq.com') {
            const pkg = getPackageName();
            if (!pkg) return;
            fetchAppDetail(pkg).then(function (info) {
                if (!info.apkUrl) return;
                const container = document.querySelector('.detail-info, .app-info, [class*="detail"]') || document.body;
                const div = document.createElement('div');
                div.style.cssText = 'margin:16px;padding:14px 18px;background:#f0fff4;border:1px solid #07c160;border-radius:10px;font-size:14px;';
                div.innerHTML = `
<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
    <span><strong>${escHtml(info.appName)}</strong> ${escHtml(info.versionName)} · ${escHtml(info.fileSize || '')}</span>
    <a href="${escHtml(info.apkUrl)}" target="_blank" style="
        display:inline-block;padding:8px 18px;background:#07c160;color:#fff;
        border-radius:6px;text-decoration:none;font-weight:600;
    ">⬇ 下载 APK</a>
</div>`;
                container.insertBefore(div, container.firstChild);
            }).catch(function () {});
        }
    }

    GM_addStyle(`
        #yyb-direct-dl-btn { top:80px;bottom:auto; }
        @media (max-width:640px) {
            #yyb-direct-dl-btn {
                right:12px;top:auto;bottom:20px;
                padding:14px 20px;font-size:14px;
                border-radius:12px;
                box-shadow:0 4px 20px rgba(7,193,96,.4);
            }
            #yyb-direct-dl-dialog > div {
                min-width:auto;width:92vw;max-width:400px;
                padding:24px 18px;margin:16px;box-sizing:border-box;
            }
            #yyb-direct-dl-dialog button {
                padding:14px 24px !important;font-size:15px !important;
            }
            #yyb-direct-dl-dialog table { font-size:13px; }
        }
    `);

    if (window.location.hostname === 'sj.qq.com' && /^\/appdetail\//.test(window.location.pathname)) {
        var check = setInterval(function () {
            if (document.body) {
                clearInterval(check);
                injectButton();
            }
        }, 200);
    }

    handleDirectPage();

})();
