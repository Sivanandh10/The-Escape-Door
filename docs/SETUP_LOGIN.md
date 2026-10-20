# Customer login setup (Google + MyAnimeList)

The code for customer accounts is already built: the login modal, `/login`, `/account`, `/auth/callback`, MyAnimeList connect and Admin → Customers. You only need to switch the providers on.

Everything here is free: Google OAuth, the MyAnimeList API, the Supabase free tier and Netlify environment variables.

**Values you'll paste below**

| What | Value |
| --- | --- |
| Live site | `https://the-escape-door.netlify.app` |
| Supabase project | `https://ejjhsmsymxlzzvzovxrb.supabase.co` |
| Google redirect URI (goes in Google Cloud) | `https://ejjhsmsymxlzzvzovxrb.supabase.co/auth/v1/callback` |
| MyAnimeList redirect URL (goes in MAL) | `https://the-escape-door.netlify.app/api/auth/mal/callback` |

**Until at least one login method works, nobody is locked out.** The site checks which methods are live (`/api/auth/providers`). While none is, the Google and MyAnimeList buttons show **Coming soon**, adding to the cart needs no login, and checkout becomes **Order on WhatsApp** (the order is typed out in WhatsApp, as before accounts). As soon as Google or MyAnimeList is switched on, login is required again for cart, wishlist, reminders and checkout. Nothing needs redeploying for Google; MyAnimeList needs one redeploy because it uses Netlify variables.

## Morning checklist (in this order)

| # | Who | What | Where in this guide | Time |
| --- | --- | --- | --- | --- |
| 1 | Lead | Run the SQL migrations 0004 → 0009 | Step 0.1 | 5 min |
| 2 | Lead | Check `SUPABASE_SERVICE_ROLE_KEY` on Netlify | Step 0.2 | 1 min |
| 3 | Owner | Supabase Site URL + redirect URLs | Step 1 | 2 min |
| 4 | Owner | Google Cloud OAuth client → paste into Supabase | Step 2 | 10 min |
| 5 | Owner | MyAnimeList API app → 3 Netlify variables | Step 3 | 5 min |
| 6 | Lead | Push `main`, then Netlify **Clear cache and deploy site** | Step 0.3 | 5 min |
| 7 | Owner | Test Google, then MyAnimeList, in a private window | Steps 2c, 3c | 3 min |

Do steps 3 and 4 **before** step 6 if you can. If the deploy goes out first, the shop simply runs in WhatsApp-order mode until Google is on.

---

## 0. Before you start (lead, one time)

1. In the Supabase dashboard, open **SQL Editor** and run these files from `supabase/migrations/`, one at a time, in this order. Open each file, copy all of it, paste it into a new query and click **Run**. Each one stops with a clear message if an earlier one is missing, undoes itself if its final checks fail, and is safe to run twice.

   | Order | File | What it adds |
   | --- | --- | --- |
   | 1 | `0004_perms.sql` | New team permissions: customers.view, vouchers.edit, careers.edit, pages.edit (skip if already run) |
   | 2 | `0005_customers.sql` | Customer profiles, MyAnimeList links, recently viewed |
   | 3 | `0006_checkout.sql` | Addresses, order columns, vouchers, the order function |
   | 4 | `0007_careers.sql` | Jobs, applications, the private `careers` résumé bucket |
   | 5 | `0008_pages.sql` | Editable policy pages + live admin updates |
   | 6 | `0009_hardening.sql` | Security fixes: shoppers can only edit name + phone, no MyAnimeList on team accounts |

   After 0007 and 0008, check **Database → Publications → supabase_realtime** lists `job_applications`, `leads`, `orders` and `analytics_events`. If not, the admin simply refreshes every 30 seconds instead.
2. In Netlify, open **Site configuration → Environment variables** and check that `SUPABASE_SERVICE_ROLE_KEY` is set (it's the same value as in `.env.local`). MyAnimeList login, checkout orders, vouchers, careers uploads and Admin → Customers all need it.
3. Push `main` and, in Netlify, use **Deploys → Trigger deploy → Clear cache and deploy site** (this also picks up the newest Netlify Next.js adapter, which matters for the hero text refresh). Check the deploy log shows `@netlify/plugin-nextjs` 5.16.4 or later.

## 1. Supabase: site URL and redirect URLs (about 2 minutes)

Supabase dashboard → **Authentication → URL Configuration**

1. **Site URL**: `https://the-escape-door.netlify.app`
2. Under **Redirect URLs**, click **Add URL** and add each of these:
   - `https://the-escape-door.netlify.app/**`
   - `http://localhost:3100/**` (local testing)
   - `https://*--the-escape-door.netlify.app/**` (Netlify deploy previews; optional)
3. Click **Save**.

If you skip this step, Google login sends people back to the home page while still signed out.

## 2. Google login (about 10 minutes)

### 2a. Google Cloud: create the OAuth client

1. Go to https://console.cloud.google.com/, sign in with the business Google account and create a project named `The Escape Door` (project picker at the top → **New project**).
2. Open **APIs & Services → OAuth consent screen**. This opens the **Google Auth Platform** page; click **Get started**.
   - **App name**: `The Escape Door`
   - **User support email**: your email
   - **Audience**: **External**
   - **Contact email**: your email
   - Accept the policy, then click **Create**.
3. Open **Branding** in the left menu:
   - **App home page**: `https://the-escape-door.netlify.app`
   - **Privacy policy**: `https://the-escape-door.netlify.app/policies/privacy` (open it once to check that it loads)
   - **Authorized domains**: add `the-escape-door.netlify.app` and `ejjhsmsymxlzzvzovxrb.supabase.co`
   - A logo is optional. Adding one means Google has to verify the app, so leave it empty for now.
   - Click **Save**.
4. Open **Data access → Add or remove scopes**, tick `.../auth/userinfo.email`, `.../auth/userinfo.profile` and `openid`, then click **Update** and **Save**. These basic scopes don't need Google verification.
5. Open **Audience** and click **Publish app** to set the status to **In production**. While the app is in "Testing", only test users you list by hand can log in.
6. Open **Clients → Create client**:
   - **Application type**: **Web application**
   - **Name**: `Escape Door web`
   - **Authorized JavaScript origins**: `https://the-escape-door.netlify.app` and `http://localhost:3100`
   - **Authorized redirect URIs**: `https://ejjhsmsymxlzzvzovxrb.supabase.co/auth/v1/callback`
   - Click **Create**, then copy the **Client ID** and **Client secret**.

### 2b. Supabase: turn Google on

Supabase dashboard → **Authentication → Sign In / Providers → Google**

1. Turn on **Enable Sign in with Google**.
2. Paste the **Client ID** and the **Client Secret**. Leave the other fields empty.
3. Click **Save**.

### 2c. Test it

1. Open https://the-escape-door.netlify.app/login in a private window and click **Continue with Google**.
2. Pick your account. You should land on `/account` with a "You're in" toast.

If Google shows `redirect_uri_mismatch`, the redirect URI in step 2a.6 is wrong. It must be exactly `https://ejjhsmsymxlzzvzovxrb.supabase.co/auth/v1/callback`.

## 3. MyAnimeList login and connect (about 5 minutes)

MyAnimeList isn't a Supabase provider, so the site runs this login itself. You only need a MAL API client and three Netlify variables.

### 3a. Register the app on MyAnimeList

1. Log in to MyAnimeList and open https://myanimelist.net/apiconfig, then click **Create ID**.
2. Fill in the form:
   - **App Name**: `The Escape Door`
   - **App Type**: **web**. The type matters: only "web" gives you a Client Secret.
   - **App Description**: `Anime merch store. Members can log in with MyAnimeList and get merch picks based on the anime they watch.`
   - **App Redirect URL**: `https://the-escape-door.netlify.app/api/auth/mal/callback`
   - **Homepage URL**: `https://the-escape-door.netlify.app`
   - **Commercial / Non-Commercial**: **commercial**, because the site sells merch
   - **Name / Company Name**: your business name
   - **Purpose of Use**: pick the closest option (for example "other") and describe it as above
   - Accept the API License Agreement, then click **Submit**.
3. Open the new app with **Edit** and copy the **Client ID** and the **Client Secret**.

### 3b. Netlify environment variables

Netlify → the site → **Site configuration → Environment variables → Add a variable**. Set the scope to all scopes and the same value for all deploy contexts.

| Key | Value |
| --- | --- |
| `MAL_CLIENT_ID` | Client ID from MAL |
| `MAL_CLIENT_SECRET` | Client Secret from MAL (keep it secret) |
| `MAL_REDIRECT_URI` | `https://the-escape-door.netlify.app/api/auth/mal/callback` |

Then open **Deploys → Trigger deploy → Deploy site**. New variables only apply to a fresh deploy.

Use a **personal** MyAnimeList account to test, not one tied to a team (admin) login. For safety the site refuses to link MyAnimeList to any account listed in Admin → Team, and shows "Team accounts can't use MyAnimeList login".

### 3c. Test it

1. Open https://the-escape-door.netlify.app/login in a private window. The **Continue with MyAnimeList** button should now be active.
2. Click it and approve on MAL. You land on `/account`, where the MyAnimeList section shows your top anime and the **Picked for you** section shows "Because you watched …" rows.
3. To link MAL to an existing account instead: log in with Google, open `/account`, go to the MyAnimeList section and click **Connect MyAnimeList**.

**Testing locally (optional):** put the same `MAL_CLIENT_ID` and `MAL_CLIENT_SECRET` in `.env.local` and add `MAL_REDIRECT_URI=http://localhost:3100/api/auth/mal/callback`. If the MAL form accepts only one redirect URL, create a second MAL app called `The Escape Door (dev)` for localhost.

## 4. Email and password login (optional, do later)

Email sign-up, "forgot password" and magic links are built in. Supabase's built-in email sender has two limits:

- It only delivers to members of your Supabase team. Every other address fails with "Email address not authorized".
- It sends at most **2 emails per hour**.

So email login won't work for real customers until custom SMTP is connected. Until then the site counts email as "not live" and tells shoppers to use Google or MyAnimeList. When you're ready (free):

1. Create a free account at **Brevo** (300 emails per day, and a single sender address can be verified without owning a domain) or **Resend** (3,000 emails per month, but you need your own domain).
2. Supabase → **Authentication → Emails → SMTP Settings**: turn on **Enable Custom SMTP** and paste the host, port (587), username, password and sender (for example `no-reply@<your-domain>`, sender name `The Escape Door`).
3. Supabase → **Authentication → Rate Limits**: raise **emails per hour** (it's 30 after custom SMTP) to something like 100.
4. Supabase → **Authentication → Sign In / Providers → Email**: keep **Confirm email** ON and set the minimum password length to 8.
5. Recommended: Supabase → **Authentication → Emails → Templates**. Change the link in **Confirm signup**, **Magic Link** and **Reset Password** so links also work when opened on another device:
   - Confirm signup: `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email`
   - Magic Link: `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email`
   - Reset Password: `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery`

   Without this change the default links still work, but only in the same browser where the person asked for them.
6. Netlify → **Environment variables**: add `AUTH_EMAIL_LIVE` = `1`, then redeploy. This tells the site email login now reaches customers (it can't detect custom SMTP by itself). Skip this and email still works, but the site won't count it when deciding whether login is required.

## 5. Who can see what

- **Shoppers** see only their own profile, orders, addresses, recently viewed products and MyAnimeList data.
- The MyAnimeList refresh token is never sent to a browser. The database denies browser access to that column, and only server code with the service role can read it.
- **Team**: Admin → Customers (`/admin/customers`) needs the `customers.view` permission (sales and admin have it by default). It lists real customer accounts and leaves team members out. It shows signup date, login method, number of orders, total spent and last seen. A drawer has each customer's addresses, orders, recent views and top MyAnimeList anime, and there is CSV export.
- Team members logging in to `/admin` never get a customer profile created automatically.

## 6. Quick troubleshooting

| What you see | Fix |
| --- | --- |
| "Google login isn't switched on yet" | Step 2b: Google isn't enabled in Supabase, or wasn't saved. |
| Back on the home page, still signed out, after Google | Step 1: the redirect URLs are missing. |
| `redirect_uri_mismatch` on Google | Step 2a.6: the redirect URI must be the supabase.co `/auth/v1/callback` URL. |
| "Access blocked: app is in testing" on Google | Step 2a.5: click **Publish app**. |
| MyAnimeList button says **Coming soon** | Step 3b: the variables are missing, or the site wasn't redeployed. |
| MAL says the redirect URL is invalid | The MAL **App Redirect URL** and `MAL_REDIRECT_URI` must match exactly. |
| "We couldn't start your session" after MAL | `SUPABASE_SERVICE_ROLE_KEY` is missing on Netlify (step 0.2). |
| "We can't send login emails just yet" | Step 4: connect custom SMTP. |
| "Team accounts can't use MyAnimeList login" | Expected: use a personal MAL account with a shopper login, not an admin account. |
| Checkout says **Order on WhatsApp** instead of asking to log in | No login method is live yet: finish step 2 (Google) or step 3 (MAL). Check `https://the-escape-door.netlify.app/api/auth/providers`, it should show `"google":true`. The answer is cached for up to 2 minutes. |
| Hero text saved in /admin/settings doesn't show | Step 0.3: deploy with **Clear cache**. If the save says "Someone saved these settings after you opened this page", reload the settings page and make the change again. |
