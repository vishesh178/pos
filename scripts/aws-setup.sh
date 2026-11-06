#!/usr/bin/env bash
# ==============================================================================
# AWS EC2 Free Tier Ubuntu Deployment Script for Curated Art / Gokul Traders POS
# ==============================================================================
set -e

echo "=== 1. Setting up 2GB Swap Memory (Prevents Out-Of-Memory on 1GB RAM instances) ==="
if [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  echo "Swapfile created and activated successfully."
fi

echo "=== 2. Updating System Packages & Installing Dependencies ==="
sudo apt-get update -y
sudo apt-get install -y curl git nginx ufw build-essential

echo "=== 3. Installing Node.js 22 LTS ==="
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "Node.js Version: $(node -v)"
echo "NPM Version: $(npm -v)"

echo "=== 4. Installing PM2 Process Manager ==="
sudo npm install -g pm2

echo "=== 5. Installing Project Dependencies & Building Client ==="
npm install
npx prisma generate --schema=server/prisma/schema.prisma
npm run build:client

echo "=== 6. Configuring Nginx Reverse Proxy (Port 80 -> Port 5001) ==="
sudo tee /etc/nginx/sites-available/pos-erp > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/pos-erp /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

echo "=== 7. Starting Application with PM2 ==="
pm2 start ecosystem.config.js
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME || true

echo "=== Deployment Complete! ==="
echo "Access your ERP/POS at: http://$(curl -s http://checkip.amazonaws.com || curl -s ifconfig.me)"
