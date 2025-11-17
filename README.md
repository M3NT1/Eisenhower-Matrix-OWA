# 📊 Exchange Prioritizer - Eisenhower Matrix Extension

Chrome extension az e-mailek priorizálásához Eisenhower mátrix alapján.

## 🚀 Telepítés Developer Módban

### 1. Ikonok Generálása

Az extension használatához szükséges PNG ikonok:

1. Nyisd meg a `icons/generate-icons.html` fájlt böngészőben
2. Kattints az "Összes Ikon Generálása" gombra
3. Mentsd le a 3 generált PNG fájlt az `icons/` mappába:
   - `icon16.png`
   - `icon48.png`
   - `icon128.png`

### 2. Chrome Extension Betöltése

1. **Chrome megnyitása**: Indítsd el a Google Chrome böngészőt
2. **Extensions oldal**: Navigálj a `chrome://extensions/` címre
3. **Developer mode**: Kapcsold be a jobb felső sarokban a "Developer mode" kapcsolót
4. **Load unpacked**: Kattints a "Load unpacked" gombra
5. **Mappa kiválasztása**: Válaszd ki az `Eisenhower_matrix` mappát
6. **Kész!**: Az extension betöltődött

## 📖 Használat

### Alapvető Működés

1. **Extension megnyitása**: Kattints az extension ikonjára a Chrome toolbar-on
2. **Priorizálás**: 
   - Válassz ki egy e-mailt a webmail oldalon
   - Az extension popup-ban állítsd be a **Fontosságot** (1-4)
   - Állítsd be a **Sürgősséget** (1-4)
   - Az automatikusan megjelenő kategória mutatja az Eisenhower besorolást
3. **Mentés**: Kattints a "💾 Mentés" gombra
4. **Vizuális visszajelzés**: Az e-mail színkódolva lesz a kategória szerint:
   - 🔴 **Do First** (Fontos + Sürgős): Piros
   - 🟡 **Schedule** (Fontos + Nem sürgős): Sárga
   - 🔵 **Delegate** (Nem fontos + Sürgős): Kék
   - 🟢 **Eliminate** (Nem fontos + Nem sürgős): Zöld

### Tab-ok

#### 📍 Priorizálás Tab
- Fontosság és sürgősség beállítása
- Azonnali kategória megjelenítés
- Mentés gomb

#### 📊 Mátrix Tab
- Az összes priorizált e-mail megtekintése kategóriánként
- 4 kvadráns az Eisenhower mátrix szerint
- Törlés funkció minden elemhez
- Frissítés gomb

#### ⚙️ Beállítások Tab
- Exchange Server URL megadása
- Automatikus kategorizálás be/ki kapcsolása
- Összes adat törlése

## 🏗️ Architektúra

### Manifest v3 Struktúra

```
Eisenhower_matrix/
├── manifest.json          # Extension konfiguráció
├── icons/                 # Extension ikonok (16x16, 48x48, 128x128)
│   ├── icon16.png
│   ├── icon48.png
│   ├── icon128.png
│   └── generate-icons.html
├── popup.html            # Popup UI
├── popup.css             # Popup stílusok
├── popup.js              # Popup logika
├── background.js         # Service Worker (háttér logika)
├── content-script.js     # Oldal módosító script
└── styles.css            # Injektált stílusok
```

### Komponensek

#### 1. **Background Service Worker** (`background.js`)
- Manifest v3 kompatibilis service worker
- Telepítési események kezelése
- Periodikus cleanup (30 napos adat törlés)
- Message routing
- Context menu létrehozás
- Hibakezelés

#### 2. **Content Script** (`content-script.js`)
- DOM manipuláció
- E-mail elemek detektálása (több selector támogatás)
- Színkódolás alkalmazása
- MutationObserver a dinamikus tartalmakhoz
- Storage sync az oldalon

#### 3. **Popup UI** (`popup.html`, `popup.js`, `popup.css`)
- 3 tab-es felület
- Interaktív gomb csoportok
- Real-time kategória kalkuláció
- Notification rendszer
- Matrix vizualizáció
- Settings management

## 🔒 Biztonsági Megfontolások

### Permissions
- `storage`: Adatok mentése (local + sync)
- `scripting`: Content script injektálás
- `activeTab`: Aktív tab hozzáférés
- `alarms`: Periodikus műveletek
- `host_permissions`: Minden weboldalon működik

### Content Security Policy
```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'"
}
```

## 💾 Adattárolás

### Chrome Storage Local
```javascript
{
  emailPriorities: {
    "email_id_1": {
      id: "email_id_1",
      subject: "Email tárgya",
      importance: 3,
      urgency: 4,
      timestamp: "2025-11-17T10:30:00.000Z"
    }
  }
}
```

### Chrome Storage Sync
```javascript
{
  exchangeUrl: "http://sys-xch11.alig.hu",
  autoCategorize: false
}
```

## 🎨 Design System

### Színséma
- **Primary**: Teal (#21808D)
- **Background**: Cream (#FCFCF9)
- **Surface**: White (#FFFFFE)
- **Text**: Slate (#13343B)

### Dark Mode Support
Automatikus dark mode detektálás `prefers-color-scheme: dark` alapján.

## 🐛 Troubleshooting

### Extension nem töltődik be
1. Ellenőrizd, hogy az `icons/` mappában vannak PNG fájlok
2. Nézd meg a `chrome://extensions/` oldalon az errors tab-ot
3. Console-ban kerrd meg a hibaüzeneteket

### E-mailek nem színeződnek
1. Frissítsd az oldalt
2. Ellenőrizd a browser console-t (F12)
3. Nézd meg, hogy a content script injektálódott-e

### Adatok nem mentődnek
1. Ellenőrizd a `storage` permissiont
2. Nézd meg a background service worker console-t
3. Storage quota ellenőrzése: `chrome://quota-internals/`

## 📋 Best Practices

### Manifest v3 Követelmények
✅ Service Worker használata background script helyett  
✅ Async/await használata callback-ek helyett  
✅ Deklaratív permissions  
✅ CSP compliance  
✅ Optional permissions minimalizálása  

### Performance
✅ Debouncing DOM műveleteknél  
✅ MutationObserver optimalizáció  
✅ Minimal content script injection  
✅ Lazy loading

### Accessibility
✅ ARIA labels  
✅ Keyboard navigation  
✅ Color contrast (WCAG AA)  
✅ Screen reader support

## 🔄 Frissítések

### Version History
- **v1.0.0** (2025-11-17): Kezdeti release
  - Eisenhower matrix priorizálás
  - 4 kvadráns vizualizáció
  - Dark mode support
  - Notification rendszer
  - 30 napos auto-cleanup

## 🤝 Közreműködés

Ez a projekt egy Chrome extension demonstráció Eisenhower mátrix alapú e-mail priorizáláshoz.

## 📄 Licenc

MIT License - szabadon használható és módosítható

## 📞 Support

Ha problémád van:
1. Nézd meg a console hibaüzeneteket
2. Ellenőrizd a README troubleshooting szekcióját
3. Teszteld más webmail szolgáltatásokkal

---

**Készítve**: 2025-11-17  
**Chrome Verzió**: 120+  
**Manifest Version**: 3
