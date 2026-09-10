// ==UserScript==
// @name         TrueWiFi Auto Login (New Portal)
// @namespace    truewifi-autologin
// @version      1.0.0
// @description  กรอก username/password และกดปุ่ม "เข้าสู่ระบบ" อัตโนมัติ + นับถอยหลัง 3 นาที (HH:mm:ss) แล้วกด Logout อัตโนมัติบนหน้า login-success
// @author       Wachira Duangdee https://github.com/wachira90
// @match        https://portal.trueinternet.co.th/wifi/portal/truewifi/web/index.php
// @match        https://portal.trueinternet.co.th/wifi/portal/truewifi/web/login-success.php*
// @match        https://portal.trueinternet.co.th/wifi/portal/truewifi/web/logout.php*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM.getValue
// @grant        GM.setValue
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
    'use strict';

    // ================= Config =================
    const CONFIG = {
        username: 'YourUsername', // ทรูไอดี / ชื่อผู้ใช้งาน (ไม่ต้องใส่ @)
        password: 'YourPassword', // รหัสผ่าน
        autoSubmit: true,         // true = กดปุ่ม "เข้าสู่ระบบ" อัตโนมัติ
        clickDelay: 1000,         // หน่วงเวลาก่อนกดปุ่ม (มิลลิวินาที)
        sessionMinutes: 75,        // จำนวนนาทีที่ให้ใช้งาน ก่อน logout อัตโนมัติ 75 = 1 ชม 15 นาที
    };
    // ================= Config =================

    const PAGE = {
        login: '/wifi/portal/truewifi/web/index.php',
        success: '/wifi/portal/truewifi/web/login-success.php',
        logout: '/wifi/portal/truewifi/web/logout.php',
    };

    const STORE_PREFIX = 'tw_autologin_';

    // อ่านค่า: GM storage (Tampermonkey/Violentmonkey) → localStorage (Greasemonkey 4+)
    async function getStored(key) {
        if (typeof GM_getValue === 'function') {
            try {
                const v = await GM_getValue(key, null);
                if (v !== null && v !== undefined && v !== '') return v;
            } catch (e) { /* ignore */ }
        }
        return localStorage.getItem(STORE_PREFIX + key);
    }

    function setStored(key, val) {
        try {
            if (typeof GM_setValue === 'function') GM_setValue(key, val);
        } catch (e) { /* ignore */ }
        try { localStorage.setItem(STORE_PREFIX + key, val); } catch (e) { /* ignore */ }
    }

    // ตั้งค่า input แบบ native setter + dispatch events (กัน framework ไม่เห็นค่า)
    function setNativeValue(el, value) {
        const proto = el instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : el instanceof HTMLSelectElement
                ? HTMLSelectElement.prototype
                : HTMLInputElement.prototype;
        const desc = Object.getOwnPropertyDescriptor(proto, 'value');
        if (desc && desc.set) {
            desc.set.call(el, value);
        } else {
            el.value = value;
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function showToast(msg) {
        const el = document.createElement('div');
        el.textContent = msg;
        Object.assign(el.style, {
            position: 'fixed', top: '12px', right: '12px', zIndex: 999999,
            background: 'rgba(0,0,0,.85)', color: '#fff', padding: '10px 16px',
            borderRadius: '6px', font: '14px/1.4 sans-serif',
            boxShadow: '0 2px 8px rgba(0,0,0,.3)',
        });
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 4000);
    }

    async function autoLogin() {
        const username = (await getStored('username')) || CONFIG.username;
        const password = (await getStored('password')) || CONFIG.password;

        if (!username || username === 'YourUsername' || !password || password === 'YourPassword') {
            showToast('TrueWiFi Auto Login: ยังไม่ได้ตั้งค่า username/password ในสคริปต์');
            return;
        }

        const userEl = document.getElementById('username');
        const passEl = document.getElementById('password');
        if (!userEl || !passEl) {
            showToast('TrueWiFi Auto Login: ไม่พบฟอร์ม login');
            return;
        }

        setNativeValue(userEl, username);
        setNativeValue(passEl, password);

        if (!CONFIG.autoSubmit) {
            showToast('TrueWiFi Auto Login: กรอกข้อมูลแล้ว (กดปุ่มเอง)');
            return;
        }

        // หน่วงเวลา 2 วินาที แล้วค่อยกดปุ่ม "เข้าสู่ระบบ"
        setTimeout(() => {
            // ปุ่มเป็น type="button" + onclick="Validation()" → ต้อง click ปุ่ม ไม่ใช่ form.submit()
            const btn = document.querySelector(
                'button.btn-primary, button[onclick*="Validation"], form#form button[type="submit"]'
            );
            if (btn) {
                btn.click();
                showToast('TrueWiFi Auto Login: กำลังเข้าสู่ระบบ...');
            } else if (typeof Validation === 'function') {
                Validation();
            } else {
                const form = document.getElementById('form') || document.forms[0];
                if (form) form.submit();
            }
        }, CONFIG.clickDelay);
    }

    // ================= หน้า login-success: countdown + logout อัตโนมัติ =================
    function handleSuccessPage() {
        const KEY = 'tw_session_deadline';
        const totalMs = CONFIG.sessionMinutes * 60 * 1000;

        // เก็บ deadline ไว้ใน sessionStorage → reload หน้าก็ไม่นับใหม่
        let deadline = Number(sessionStorage.getItem(KEY));
        if (!deadline || deadline <= Date.now()) {
            deadline = Date.now() + totalMs;
            sessionStorage.setItem(KEY, String(deadline));
        }

        // สร้าง overlay ครึ่งหน้าจอด้านบน (ไม่บังการคลิก)
        const overlay = document.createElement('div');
        overlay.id = 'tw-countdown-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', right: '0', height: '50vh',
            zIndex: 999999,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,.55)',
            pointerEvents: 'none',
        });

        const label = document.createElement('div');
        label.textContent = 'เหลือเวลาอีก';
        Object.assign(label.style, {
            color: '#fff', fontSize: '28px', fontWeight: 'bold',
            fontFamily: 'sans-serif', marginBottom: '8px',
            textShadow: '0 2px 8px rgba(0,0,0,.6)',
        });

        const timeEl = document.createElement('div');
        Object.assign(timeEl.style, {
            color: '#ff9800', fontSize: '120px', fontWeight: 'bold',
            fontFamily: 'Consolas, Menlo, monospace', lineHeight: '1',
            textShadow: '0 4px 16px rgba(0,0,0,.7)',
        });

        overlay.appendChild(label);
        overlay.appendChild(timeEl);
        document.body.appendChild(overlay);

        const fmt = (n) => String(n).padStart(2, '0');

        const tick = () => {
            const left = Math.max(0, deadline - Date.now());
            const total = Math.floor(left / 1000);
            timeEl.textContent = fmt(Math.floor(total / 3600)) + ':' +
                                 fmt(Math.floor(total / 60) % 60) + ':' +
                                 fmt(total % 60);
            if (left <= 0) {
                clearInterval(timer);
                sessionStorage.removeItem(KEY);
                overlay.remove();
                clickLogout();
            }
        };

        const timer = setInterval(tick, 1000);
        tick();

        // กดปุ่ม Logout (ปุ่มเป็น type="button" + onclick="location.href='logout.php?lang=th'")
        function clickLogout() {
            const btn = document.querySelector('button[onclick*="logout.php"], button.btn-secondary');
            if (btn) {
                btn.click();
            } else {
                location.href = 'logout.php?lang=th';
            }
        }
    }

    // ================= หน้า logout: overlay ครึ่งจอบน + หน่วง 1 วินาที แล้ว redirect กลับหน้า login =================
    function handleLogoutPage() {
        // สร้าง overlay ครึ่งหน้าจอด้านบน (template เดียวกับหน้า login-success)
        const overlay = document.createElement('div');
        overlay.id = 'tw-logout-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', right: '0', height: '50vh',
            zIndex: 999999,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,.55)',
            pointerEvents: 'none',
        });

        const label = document.createElement('div');
        label.textContent = 'Redirecting to Login Page ....';
        Object.assign(label.style, {
            color: '#fff', fontSize: '28px', fontWeight: 'bold',
            fontFamily: 'sans-serif', marginBottom: '8px',
            textShadow: '0 2px 8px rgba(0,0,0,.6)',
        });

        overlay.appendChild(label);
        document.body.appendChild(overlay);

        setTimeout(() => {
            location.href = 'https://portal.trueinternet.co.th/wifi/portal/truewifi/web/index.php?lang=th';
        }, 1000);
    }

    // รอให้ฟอร์มโหลดเสร็จ (polling สูงสุด 15 วินาที)
    function waitForForm(callback, timeoutMs) {
        const started = Date.now();
        const check = () => {
            if (document.getElementById('username') && document.getElementById('password')) {
                callback();
                return;
            }
            if (Date.now() - started > timeoutMs) return;
            setTimeout(check, 300);
        };
        check();
    }

    // ================= จัดการตามหน้า (เช็คจาก pathname ไม่สนใจ query string) =================
    const path = location.pathname;
    if (path === PAGE.login) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => waitForForm(autoLogin, 15000));
        } else {
            waitForForm(autoLogin, 15000);
        }
    } else if (path === PAGE.success) {
        handleSuccessPage();
    } else if (path === PAGE.logout) {
        handleLogoutPage();
    }
})();