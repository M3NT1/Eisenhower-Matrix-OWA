# 🚀 Gyors Telepítési Útmutató

## Lépések Developer Módban Történő Teszteléshez

### 1️⃣ Ikonok Generálása (FONTOS!)

Az ikonokat az alábbi módon generálhatod:

**Böngészős módszer** (Ajánlott):
1. Nyisd meg böngészőben: `icons/generate-icons.html`
2. Automatikusan megjelennek a preview-k
3. Kattints az **"Összes Ikon Generálása"** gombra
4. Mentsd le a 3 PNG fájlt az `icons/` mappába:
   - `icon16.png`
   - `icon48.png`  
   - `icon128.png`

**Vagy használd a mellékelt SVG fájlokat** (kevésbé ajánlott):
- Átnevezd az SVG-ket PNG-re (Chrome elfogadja):
  ```bash
  cp icons/icon16.svg icons/icon16.png
  cp icons/icon48.svg icons/icon48.png
  cp icons/icon128.svg icons/icon128.png
  ```

### 2️⃣ Chrome Extension Betöltése

1. **Chrome megnyitása**
2. **Írd be a címsorba**: `chrome://extensions/`
3. **Developer mode BE**: Jobb felső sarok kapcsoló
4. **Load unpacked**: Bal felső "Load unpacked" gomb
5. **Válaszd ki**: Az `Eisenhower_matrix` mappát
6. ✅ **Kész!**

### 3️⃣ Tesztelés

1. Nyiss meg egy webmail oldalt (pl. Gmail, Outlook)
2. Kattints az extension ikonjára a Chrome toolbar-ban
3. Válassz egy e-mailt
4. Állítsd be a fontosságot és sürgősséget
5. Kattints a "💾 Mentés" gombra
6. Az e-mail színkódolva lesz! 🎨

## 📊 Kategóriák

- 🔴 **Do First** (Fontos + Sürgős) → Piros kiemelés
- 🟡 **Schedule** (Fontos + Nem sürgős) → Sárga kiemelés
- 🔵 **Delegate** (Nem fontos + Sürgős) → Kék kiemelés
- 🟢 **Eliminate** (Nem fontos + Nem sürgős) → Zöld kiemelés

## 🐛 Gyakori Problémák

### "Manifest file is missing or unreadable"
→ Biztos vagy benne, hogy a **teljes mappát** választottad ki, nem csak egy fájlt?

### Nincs ikon az extension-nél
→ Generáltad le a PNG ikonokat a `generate-icons.html` segítségével?

### Az e-mailek nem színeződnek
→ Frissítsd az oldalt (F5) vagy nézd meg a browser console-t (F12 → Console)

### Permission hiba
→ Engedélyezd a kért permissionokat az extension betöltésekor

## 📁 Fájlstruktúra Ellenőrzés

A mappádban lennie kell:
```
Eisenhower_matrix/
├── manifest.json          ✅
├── popup.html            ✅
├── popup.css             ✅
├── popup.js              ✅
├── background.js         ✅
├── content-script.js     ✅
├── styles.css            ✅
├── README.md             ✅
└── icons/
    ├── icon16.png        ⚠️ GENERÁLD LE!
    ├── icon48.png        ⚠️ GENERÁLD LE!
    └── icon128.png       ⚠️ GENERÁLD LE!
```

## 🎯 Következő Lépések

1. ✅ Ikonok generálása
2. ✅ Extension betöltése Chrome-ba
3. ✅ Webmail oldal megnyitása
4. ✅ Tesztelés különböző e-mailekkel
5. ✅ Mátrix tab megtekintése
6. ✅ Beállítások testreszabása

---

**Kellemes használatot!** 🚀

Ha bármi kérdés van, nézd meg a részletes `README.md` fájlt.
