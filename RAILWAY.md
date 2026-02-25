# ALA LEGAL - Railway Deployment Guide

## 🚀 Deploy to Railway (Free Tier Available)

### Step 1: Install Railway CLI
```bash
npm install -g @railway/cli
```

### Step 2: Login
```bash
railway login
```

### Step 3: Create Project
```bash
cd ~/.openclaw/workspace/manychat-messenger-bot
railway init
```
- Select "Empty Project"
- Name it: `alalegal-messenger-bridge`

### Step 4: Set Environment Variables
```bash
railway variables set MANYCHAT_API_KEY="416263294908731:439fac70ed0bca6edeb1956172e1beab"
railway variables set PORT="3000"
```

Or add in Railway Dashboard:
1. Go to your project
2. Click "Variables" tab
3. Add:
   - `MANYCHAT_API_KEY` = `416263294908731:439fac70ed0bca6edeb1956172e1beab`
   - `PORT` = `3000`

### Step 5: Deploy
```bash
railway up
```

### Step 6: Get Your Public URL
```bash
railway domain
```

Or in Railway Dashboard:
- Go to "Settings" tab
- Click "Generate Domain"
- Copy the URL (e.g., `https://alalegal-messenger-bridge.up.railway.app`)

### Step 7: Configure ManyChat
In your ManyChat HTTP Request action:
```
https://alalegal-messenger-bridge.up.railway.app/api/webhooks/manychat
```

---

## 📋 Alternative: Deploy via GitHub + Railway Dashboard

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial bridge setup"
# Create GitHub repo and push
```

### 2. Railway Dashboard Deploy
1. Go to [railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repo
5. Add environment variables (same as Step 4 above)
6. Deploy

---

## ✅ Verify Deployment

Test your deployed URL:
```bash
curl https://your-railway-url.up.railway.app/api/health
```

Should return:
```json
{"status":"ok","bridge":"ALA LEGAL - ManyChat Bridge"}
```

---

## 🔄 Auto-Deploy

Railway auto-deploys on every git push:
```bash
git add .
git commit -m "Update response messages"
git push
# Railway automatically redeploys
```

---

## 📊 Railway Dashboard Features

- **Logs**: View real-time logs
- **Metrics**: See request volume
- **Variables**: Update env vars without redeploy
- **Domains**: Custom domain support (Pro plan)

---

## 💰 Pricing

- **Free Tier**: 500 hours/month, sleeps after inactivity
- **Starter ($5/month)**: Always on, 1GB RAM, 1 CPU
- For production: Starter plan recommended

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| Build fails | Check `package.json` has all dependencies |
| 404 errors | Make sure `PORT` env var is set |
| Can't reach | Check Railway domain is generated |
| ManyChat errors | Verify API key in Railway variables |

---

## 📞 Your Webhook URL Will Be

```
https://alalegal-messenger-bridge.up.railway.app/api/webhooks/manychat
```

This never changes. Configure it once in ManyChat and you're done.