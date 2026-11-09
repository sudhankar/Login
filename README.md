# Midnight Aurora — Firebase Email Authentication

यह GitHub Pages के लिए responsive Login / Signup frontend है। इसमें Google Sign-In नहीं है। Signup के बाद Firebase verification email भेजा जाता है; unverified account को PDF tools तक आगे नहीं जाने दिया जाता।

## फाइलें
- `index.html` — UI और form
- `styles.css` — Midnight Aurora responsive glassmorphism design
- `app.js` — Firebase Auth, validation, verification, reset-password और Three.js mascot
- `firebase-config.js` — आपकी Firebase Web App config

## 1) Firebase सेटअप
1. https://console.firebase.google.com/ पर project बनाएँ।
2. Project Overview → Add app → Web app चुनें और config कॉपी करें।
3. `firebase-config.js` में `YOUR_...` values को अपनी वास्तविक config से बदलें।
4. Firebase Console → Authentication → Get started → Sign-in method → Email/Password enable करें। Google provider enable करने की जरूरत नहीं।
5. Authentication → Settings → Authorized domains में अपनी GitHub Pages domain जोड़ें, जैसे `yourname.github.io`। Custom domain हो तो वह भी जोड़ें।
6. Authentication → Templates → Email address verification में sender/name और email template सेट करें।

## 2) GitHub Pages पर publish
सभी चार फाइलें एक ही folder में रखें और repository में push करें। GitHub repository → Settings → Pages → Deploy from a branch → `main` और `/ (root)` चुनें। GitHub Pages पर ES modules चलते हैं; साइट HTTPS पर खुलेगी।

## 3) PDF tools पर redirect
`app.js` में यह लाइन बदलें:
```js
const PDF_TOOLS_URL = "./tools/";
```
इसे अपने PDF tools landing page के सही relative या absolute URL पर सेट करें, जैसे `"/pdf-tools/"` या `"https://example.github.io/tools/"`।

## 4) Terms और Privacy links
`index.html` में `id="terms-link"` और `id="privacy-link"` के `href` को अपनी असली Terms और Privacy Policy URLs से बदलें। फिलहाल demo placeholders हैं।

## 5) सुरक्षा — जरूरी
यह login page frontend है। जिन PDF tools/pages को login के पीछे रखना है, उन्हें केवल इस पेज पर redirect करके सुरक्षित नहीं किया जा सकता। GitHub Pages static files सार्वजनिक होती हैं। कोई भी व्यक्ति सीधे tool URL खोल सकता है या JavaScript बदल सकता है।

यदि user data, paid features, private files या privileged operations सुरक्षित करने हैं:
- हर sensitive operation को trusted backend / Cloud Functions में verify करें।
- Backend पर Firebase ID token verify करें और `email_verified === true` जाँचें।
- Firestore/Storage Security Rules में `request.auth != null` और `request.auth.token.email_verified == true` जैसी conditions लगाएँ।
- Frontend में केवल UI gating को security न मानें।
- Firebase Web API config secret नहीं होती; लेकिन service-account private key कभी frontend/GitHub में न रखें।

## 6) Local testing
ES modules और Firebase imports के लिए `file://` से सीधे खोलने के बजाय local web server या GitHub Pages पर चलाएँ। उदाहरण: VS Code Live Server.

## नोट
- Firebase config भरने तक submit button जानबूझकर disabled रहेगा।
- Email verification के बाद user को फिर से sign in करना होगा।
- Firebase email verification link default Firebase action handler से खुलेगा। यदि custom action URL/continue URL configure करते हैं तो authorized domain भी add करें.
- Three.js mascot procedural geometry से बनता है, इसलिए अलग GLB file की जरूरत नहीं। Three.js और GSAP CDN से load होते हैं; इंटरनेट कनेक्शन आवश्यक है।
