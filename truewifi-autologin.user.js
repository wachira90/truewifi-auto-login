// ==UserScript==
// @name         TrueWiFi Auto Login (New Portal)
// @namespace    truewifi-autologin
// @version      1.0.0
// @description  กรอก username/password และกดปุ่ม "เข้าสู่ระบบ" อัตโนมัติบนหน้า TrueMove H WiFi portal
// @author       wachira90
// @match        https://portal.trueinternet.co.th/wifi/portal/truewifi/web/index.php
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM.getValue
// @grant        GM.setValue
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
    'use strict';

    // ทำงานเฉพาะ URL นี้เท่านั้น
    if (location.href !== 'https://portal.trueinternet.co.th/wifi/portal/truewifi/web/index.php?lang=th') {
        return;
    }

    // ================= Config =================
    const CONFIG = {
        username: 'YourUsername', // ทรูไอดี / ชื่อผู้ใช้งาน (ไม่ต้องใส่ @)
        password: 'YourPassword', // รหัสผ่าน
        autoSubmit: true,         // true = กดปุ่ม "เข้าสู่ระบบ" อัตโนมัติ
        clickDelay: 2000,         // หน่วงเวลาก่อนกดปุ่ม (มิลลิวินาที)
    };
    // ================= Config =================

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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => waitForForm(autoLogin, 15000));
    } else {
        waitForForm(autoLogin, 15000);
    }
})();