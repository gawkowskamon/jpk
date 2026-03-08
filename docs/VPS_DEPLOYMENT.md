# Instrukcja Deploymentu JPK Converter na VPS

## Wymagania
- VPS z Ubuntu 20.04/22.04
- Domena seokurdynowski.cloud skierowana na IP VPS
- Dostęp SSH do serwera

---

## 1. Przygotowanie serwera

```bash
# Połącz się z VPS
ssh root@twoj-vps-ip

# Aktualizacja systemu
sudo apt update && sudo apt upgrade -y

# Instalacja wymaganych pakietów
sudo apt install -y git nginx python3 python3-pip python3-venv nodejs npm certbot python3-certbot-nginx

# Instalacja MongoDB
curl -fsSL https://pgp.mongodb.com/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod

# Instalacja yarn
sudo npm install -g yarn
```

---

## 2. Klonowanie repozytorium

```bash
# Utwórz katalog dla aplikacji
sudo mkdir -p /var/www/jpk
cd /var/www/jpk

# Klonuj repozytorium (zamień na swoje repo)
git clone https://github.com/TWOJ_USERNAME/TWOJE_REPO.git .
```

---

## 3. Konfiguracja Backendu (FastAPI)

```bash
# Przejdź do katalogu backend
cd /var/www/jpk/backend

# Utwórz wirtualne środowisko Python
python3 -m venv venv
source venv/bin/activate

# Zainstaluj zależności
pip install -r requirements.txt

# Utwórz plik .env
cat > .env << 'EOF'
MONGO_URL=mongodb://localhost:27017
DB_NAME=jpk_converter
CORS_ORIGINS=https://seokurdynowski.cloud
EOF
```

### Stwórz serwis systemd dla backendu:

```bash
sudo cat > /etc/systemd/system/jpk-backend.service << 'EOF'
[Unit]
Description=JPK Converter Backend
After=network.target mongod.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/jpk/backend
Environment="PATH=/var/www/jpk/backend/venv/bin"
ExecStart=/var/www/jpk/backend/venv/bin/uvicorn server:app --host 127.0.0.1 --port 8001
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# Ustaw uprawnienia
sudo chown -R www-data:www-data /var/www/jpk

# Uruchom serwis
sudo systemctl daemon-reload
sudo systemctl enable jpk-backend
sudo systemctl start jpk-backend
```

---

## 4. Konfiguracja Frontendu (React)

```bash
cd /var/www/jpk/frontend

# Utwórz plik .env dla produkcji
cat > .env << 'EOF'
REACT_APP_BACKEND_URL=https://seokurdynowski.cloud/jpk
EOF

# Zainstaluj zależności i zbuduj
yarn install
yarn build

# Przenieś build do katalogu serwera
sudo mkdir -p /var/www/jpk/public
sudo cp -r build/* /var/www/jpk/public/
```

---

## 5. Konfiguracja Nginx

```bash
sudo cat > /etc/nginx/sites-available/seokurdynowski.cloud << 'EOF'
server {
    listen 80;
    server_name seokurdynowski.cloud www.seokurdynowski.cloud;

    # Twoja główna strona (jeśli istnieje)
    root /var/www/html;
    index index.html;

    # JPK Converter - Frontend
    location /jpk {
        alias /var/www/jpk/public;
        index index.html;
        try_files $uri $uri/ /jpk/index.html;
    }

    # JPK Converter - Backend API
    location /jpk/api {
        rewrite ^/jpk/api(.*)$ /api$1 break;
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 50M;
    }
}
EOF

# Aktywuj konfigurację
sudo ln -sf /etc/nginx/sites-available/seokurdynowski.cloud /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 6. Certyfikat SSL (Let's Encrypt)

```bash
sudo certbot --nginx -d seokurdynowski.cloud -d www.seokurdynowski.cloud
```

---

## 7. Modyfikacja kodu dla subdirectory /jpk

### Frontend - zmień w package.json:

```json
{
  "homepage": "/jpk"
}
```

### Frontend - zmień w public/index.html (dodaj w <head>):

```html
<base href="/jpk/" />
```

### Frontend - przebuduj po zmianach:

```bash
cd /var/www/jpk/frontend
yarn build
sudo cp -r build/* /var/www/jpk/public/
```

---

## 8. Weryfikacja

```bash
# Sprawdź status serwisów
sudo systemctl status jpk-backend
sudo systemctl status nginx
sudo systemctl status mongod

# Sprawdź logi
sudo journalctl -u jpk-backend -f

# Test API
curl https://seokurdynowski.cloud/jpk/api/
```

---

## 9. Aktualizacja aplikacji (w przyszłości)

```bash
cd /var/www/jpk
git pull origin main

# Backend
cd backend
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart jpk-backend

# Frontend
cd ../frontend
yarn install
yarn build
sudo cp -r build/* /var/www/jpk/public/
```

---

## Rozwiązywanie problemów

### Backend nie startuje:
```bash
sudo journalctl -u jpk-backend -n 50
```

### Błędy Nginx:
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

### MongoDB:
```bash
sudo systemctl status mongod
mongosh --eval "db.adminCommand('ping')"
```

---

## Struktura katalogów na VPS

```
/var/www/jpk/
├── backend/
│   ├── server.py
│   ├── requirements.txt
│   ├── .env
│   └── venv/
├── frontend/
│   ├── src/
│   ├── package.json
│   └── build/
└── public/          # <- zbudowany frontend (serwowany przez Nginx)
    ├── index.html
    └── static/
```
