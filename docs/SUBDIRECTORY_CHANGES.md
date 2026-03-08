# Zmiany wymagane dla subdirectory /jpk

## 1. Frontend - package.json

Dodaj linię `"homepage": "/jpk"` w pliku `frontend/package.json`:

```json
{
  "name": "frontend",
  "version": "0.1.0",
  "private": true,
  "homepage": "/jpk",
  ...
}
```

## 2. Frontend - App.js

Zmień `BrowserRouter` na wersję z basename:

```jsx
// Zmień import
import { BrowserRouter, Routes, Route, NavLink, useLocation } from "react-router-dom";

// W komponencie App zmień:
<BrowserRouter basename="/jpk">
  ...
</BrowserRouter>
```

## 3. Frontend - .env (na VPS)

```
REACT_APP_BACKEND_URL=https://seokurdynowski.cloud/jpk
```

## 4. Backend - .env (na VPS)

```
MONGO_URL=mongodb://localhost:27017
DB_NAME=jpk_converter
CORS_ORIGINS=https://seokurdynowski.cloud
```

---

# Skrypt szybkiego deploymentu

Zapisz jako `deploy.sh` na VPS:

```bash
#!/bin/bash
set -e

APP_DIR="/var/www/jpk"
REPO_URL="https://github.com/TWOJ_USERNAME/TWOJE_REPO.git"

echo "=== JPK Converter Deployment ==="

# 1. Klonuj lub aktualizuj repo
if [ -d "$APP_DIR/.git" ]; then
    echo "Aktualizacja repozytorium..."
    cd $APP_DIR
    git pull origin main
else
    echo "Klonowanie repozytorium..."
    mkdir -p $APP_DIR
    git clone $REPO_URL $APP_DIR
fi

# 2. Backend
echo "Konfiguracja backendu..."
cd $APP_DIR/backend

if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

source venv/bin/activate
pip install -r requirements.txt

# Utwórz .env jeśli nie istnieje
if [ ! -f ".env" ]; then
    cat > .env << 'EOF'
MONGO_URL=mongodb://localhost:27017
DB_NAME=jpk_converter
CORS_ORIGINS=https://seokurdynowski.cloud
EOF
fi

# 3. Frontend
echo "Budowanie frontendu..."
cd $APP_DIR/frontend

# Dodaj homepage do package.json jeśli nie ma
if ! grep -q '"homepage"' package.json; then
    sed -i 's/"private": true,/"private": true,\n  "homepage": "\/jpk",/' package.json
fi

# Utwórz .env
cat > .env << 'EOF'
REACT_APP_BACKEND_URL=https://seokurdynowski.cloud/jpk
EOF

yarn install
yarn build

# Kopiuj build
mkdir -p $APP_DIR/public
cp -r build/* $APP_DIR/public/

# 4. Ustaw uprawnienia
chown -R www-data:www-data $APP_DIR

# 5. Restart serwisów
systemctl restart jpk-backend
systemctl reload nginx

echo "=== Deployment zakończony! ==="
echo "Aplikacja dostępna pod: https://seokurdynowski.cloud/jpk"
```

Uruchom: `sudo bash deploy.sh`
