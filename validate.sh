#!/bin/bash

# Extension Validation Script
# Ellenőrzi, hogy minden szükséges fájl megvan-e

echo "🔍 Exchange Prioritizer Extension Validáció"
echo "============================================"
echo ""

# Change to extension directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Required files
REQUIRED_FILES=(
    "manifest.json"
    "popup.html"
    "popup.css"
    "popup.js"
    "background.js"
    "content-script.js"
    "styles.css"
    "icons/icon16.png"
    "icons/icon48.png"
    "icons/icon128.png"
)

MISSING_FILES=0
FOUND_FILES=0

echo "📋 Fájlok ellenőrzése:"
echo ""

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
        ((FOUND_FILES++))
    else
        echo "❌ HIÁNYZIK: $file"
        ((MISSING_FILES++))
    fi
done

echo ""
echo "============================================"
echo "📊 Összesítés:"
echo "   Megtalált fájlok: $FOUND_FILES"
echo "   Hiányzó fájlok: $MISSING_FILES"
echo ""

# Check manifest.json syntax
if [ -f "manifest.json" ]; then
    if command -v jq &> /dev/null; then
        if jq empty manifest.json 2>/dev/null; then
            echo "✅ manifest.json szintaktikailag helyes"
        else
            echo "❌ manifest.json szintaktikai hiba!"
            jq . manifest.json
        fi
    else
        echo "ℹ️  jq nincs telepítve - manifest.json szintaxis ellenőrzés átugorva"
    fi
fi

echo ""

# Check file sizes
echo "📏 Fájlméretek:"
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        SIZE=$(du -h "$file" | cut -f1)
        echo "   $file: $SIZE"
    fi
done

echo ""

if [ $MISSING_FILES -eq 0 ]; then
    echo "🎉 Minden szükséges fájl megvan!"
    echo ""
    echo "🚀 Következő lépések:"
    echo "   1. Nyisd meg Chrome-ot: chrome://extensions/"
    echo "   2. Developer mode BE"
    echo "   3. Load unpacked"
    echo "   4. Válaszd ki ezt a mappát: $SCRIPT_DIR"
    echo ""
    exit 0
else
    echo "⚠️  $MISSING_FILES fájl hiányzik!"
    echo ""
    echo "📝 Hiányzó fájlok létrehozásához:"
    echo "   - Ikonok: Nyisd meg icons/generate-icons.html böngészőben"
    echo "   - Egyéb fájlok: Nézd meg a README.md-t"
    echo ""
    exit 1
fi
