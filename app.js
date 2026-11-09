import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, onAuthStateChanged,
  signOut, updateProfile, reload
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

// Change this to the actual destination of your PDF tools after successful verification.
const PDF_TOOLS_URL = "./tools/";

const $ = (id) => document.getElementById(id);
const authView = $("auth-view"), messageView = $("message-view"), signedInView = $("signed-in-view");
const form = $("auth-form"), submitBtn = $("submit-btn"), submitLabel = $("submit-label");
const nameField = $("name-field"), confirmField = $("confirm-field"), termsLine = $("terms-line");
const password = $("password"), confirmPassword = $("confirm-password");
let mode = "login", currentUser = null, pendingVerificationEmail = "", toastTimer;

$("year").textContent = new Date().getFullYear();

function showToast(message, type = "") {
  const el = $("toast"); el.textContent = message; el.className = `toast show ${type}`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.className = "toast", 4200);
}
function setBusy(busy, label) {
  submitBtn.disabled = busy; submitLabel.textContent = busy ? "Please wait…" : label;
}
function clearErrors() {
  ["name-error","email-error","password-error","confirm-error"].forEach(id => $(id).textContent = "");
}
function setError(id, message) { $(id).textContent = message; }
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function friendlyError(error) {
  const map = {
    "auth/invalid-email":"Please enter a valid email address.",
    "auth/user-not-found":"No account was found with this email.",
    "auth/wrong-password":"Incorrect password. Please try again.",
    "auth/invalid-credential":"Email or password is incorrect.",
    "auth/email-already-in-use":"This email is already registered. Please log in.",
    "auth/weak-password":"Use a stronger password (at least 6 characters).",
    "auth/too-many-requests":"Too many attempts. Please wait and try again.",
    "auth/network-request-failed":"Network error. Check your internet connection.",
    "auth/operation-not-allowed":"Email/Password sign-in is not enabled in Firebase Console.",
    "auth/invalid-api-key":"Firebase API key is missing or incorrect. Check firebase-config.js.",
    "auth/unauthorized-domain":"Add this website domain to Firebase Authentication > Settings > Authorized domains."
  };
  return map[error?.code] || error?.message || "Something went wrong. Please try again.";
}
function showAuth() {
  authView.hidden = false; messageView.hidden = true; signedInView.hidden = true;
}
function showMessage({symbol="✉", kicker="ONE LAST STEP", title="Check your inbox.", text="We sent you an email.", resend=false}) {
  authView.hidden = true; signedInView.hidden = true; messageView.hidden = false;
  $("message-symbol").textContent = symbol; $("message-kicker").textContent = kicker;
  $("message-title").innerHTML = title.replace(".", "<span>.</span>");
  $("message-text").textContent = text; $("resend-btn").hidden = !resend;
}
function showSignedIn(user) {
  authView.hidden = true; messageView.hidden = true; signedInView.hidden = false;
  $("signed-in-copy").textContent = `Signed in as ${user.email}. Your email is verified.`;
}
function setMode(next) {
  mode = next; clearErrors(); form.reset();
  const signup = mode === "signup";
  nameField.hidden = !signup; confirmField.hidden = !signup; termsLine.hidden = !signup;
  $("strength").hidden = !signup; $("forgot-link").hidden = signup;
  $("tab-login").classList.toggle("active", !signup); $("tab-signup").classList.toggle("active", signup);
  $("tab-login").setAttribute("aria-selected", String(!signup)); $("tab-signup").setAttribute("aria-selected", String(signup));
  $("switch-glider").style.transform = signup ? "translateX(100%)" : "translateX(0)";
  $("form-kicker").textContent = signup ? "YOUR NEW WORKSPACE AWAITS" : "WELCOME BACK";
  $("form-title").innerHTML = signup ? "Create account<span>.</span>" : "Sign in<span>.</span>";
  $("form-subtitle").textContent = signup ? "A few details and you're on your way." : "Pick up right where you left off.";
  submitLabel.textContent = signup ? "Create my account" : "Sign in";
  $("bottom-note").textContent = signup ? "ALREADY HAVE AN ACCOUNT?" : "NEW TO AURORA PDF?";
  $("switch-copy").innerHTML = signup
    ? 'Already registered? <button type="button" id="switch-action">Sign in</button>'
    : 'Don\'t have an account? <button type="button" id="switch-action">Create one</button>';
  password.autocomplete = signup ? "new-password" : "current-password";
  confirmPassword.value = "";
  $("toggle-password").setAttribute("aria-label", "Show password");
  password.type = "password";
  updateStrength("");
}
$("tab-login").addEventListener("click", () => setMode("login"));
$("tab-signup").addEventListener("click", () => setMode("signup"));
$("switch-action").addEventListener("click", () => setMode(mode === "signup" ? "login" : "signup"));
$("toggle-password").addEventListener("click", () => {
  const show = password.type === "password"; password.type = show ? "text" : "password";
  $("toggle-password").textContent = show ? "◎" : "◉";
  $("toggle-password").setAttribute("aria-label", show ? "Hide password" : "Show password");
  window.auroraMascot?.setMood(show ? "peek" : "idle");
});
password.addEventListener("focus", () => window.auroraMascot?.setMood("shy"));
password.addEventListener("blur", () => window.auroraMascot?.setMood("idle"));
password.addEventListener("input", () => updateStrength(password.value));
function updateStrength(value) {
  if (mode !== "signup") return;
  let score = 0;
  if (value.length >= 8) score++; if (/[A-Z]/.test(value)) score++;
  if (/[0-9]/.test(value)) score++; if (/[^A-Za-z0-9]/.test(value)) score++;
  const labels = ["Too short","Weak","Fair","Good","Strong"];
  $("strength-fill").style.width = `${score * 25}%`;
  $("strength-fill").style.background = score < 2 ? "#e87e9f" : score < 3 ? "#e8c47e" : "#69e5bc";
  $("strength-label").textContent = value ? labels[score] : "Use 8+ characters, numbers and symbols";
}
$("forgot-link").addEventListener("click", async () => {
  clearErrors(); const email = $("email").value.trim();
  if (!validEmail(email)) { setError("email-error", "Enter your email first to reset your password."); $("email").focus(); return; }
  try {
    await sendPasswordResetEmail(auth, email);
    showToast("Password reset link sent. Check your inbox.", "success");
  } catch (e) { showToast(friendlyError(e), "error"); }
});
$("terms-link").addEventListener("click", e => { e.preventDefault(); showToast("Add your Terms of Service URL in index.html.", ""); });
$("privacy-link").addEventListener("click", e => { e.preventDefault(); showToast("Add your Privacy Policy URL in index.html.", ""); });

let app, auth;
const configReady = Object.values(firebaseConfig).every(v => typeof v === "string" && v.length && !v.startsWith("YOUR_"));
if (!configReady) {
  showToast("Firebase setup pending: add your project config in firebase-config.js.", "error");
  submitBtn.disabled = true; submitLabel.textContent = "Add Firebase config first";
} else {
  try {
    app = initializeApp(firebaseConfig); auth = getAuth(app);
    onAuthStateChanged(auth, async user => {
      currentUser = user;
      if (!user) { showAuth(); return; }
      try { await reload(user); } catch {}
      if (user.emailVerified) showSignedIn(user);
      else {
        pendingVerificationEmail = user.email;
        showMessage({kicker:"EMAIL VERIFICATION REQUIRED", title:"Verify your email.", text:`Your account is created, but ${user.email} is not verified yet. Open the verification link we emailed you, then return here and sign in again.`, resend:true});
      }
    });
  } catch (e) { showToast(friendlyError(e), "error"); submitBtn.disabled = true; }
}

form.addEventListener("submit", async e => {
  e.preventDefault(); clearErrors();
  if (!auth) { showToast("First add Firebase configuration in firebase-config.js.", "error"); return; }
  const email = $("email").value.trim(), pass = password.value;
  if (mode === "signup") {
    const name = $("display-name").value.trim();
    if (name.length < 2) { setError("name-error", "Please enter your name (at least 2 characters)."); return; }
    if (!validEmail(email)) { setError("email-error", "Enter a valid email address."); return; }
    if (pass.length < 8) { setError("password-error", "Use at least 8 characters for a stronger password."); return; }
    if (pass !== confirmPassword.value) { setError("confirm-error", "Passwords do not match."); return; }
    if (!$("terms").checked) { showToast("Please accept the Terms and Privacy Policy to continue.", "error"); return; }
    setBusy(true, "Create my account");
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(credential.user, { displayName: name });
      await sendEmailVerification(credential.user);
      pendingVerificationEmail = email;
      window.auroraMascot?.setMood("happy");
      showMessage({kicker:"ACCOUNT CREATED", title:"Check your inbox.", text:`A verification link has been sent to ${email}. Verify your email before signing in. If you don't see it, check Spam/Junk.`, resend:true});
    } catch (err) { showToast(friendlyError(err), "error"); window.auroraMascot?.setMood("sad"); }
    finally { setBusy(false, "Create my account"); }
  } else {
    if (!validEmail(email)) { setError("email-error", "Enter a valid email address."); return; }
    if (!pass) { setError("password-error", "Please enter your password."); return; }
    setBusy(true, "Sign in");
    try {
      const credential = await signInWithEmailAndPassword(auth, email, pass);
      await reload(credential.user);
      if (!credential.user.emailVerified) {
        pendingVerificationEmail = email;
        await signOut(auth);
        showMessage({kicker:"ALMOST THERE", title:"Verify your email.", text:`Your email ${email} is not verified yet. Use the link we sent you, then sign in again.`, resend:true});
        window.auroraMascot?.setMood("sad");
      } else {
        window.auroraMascot?.setMood("happy"); showSignedIn(credential.user);
      }
    } catch (err) { showToast(friendlyError(err), "error"); window.auroraMascot?.setMood("sad"); }
    finally { setBusy(false, "Sign in"); }
  }
});
$("resend-btn").addEventListener("click", async () => {
  if (!auth || !pendingVerificationEmail) return;
  try {
    let user = auth.currentUser;
    if (!user && $("email").value.trim() && password.value) {
      const c = await signInWithEmailAndPassword(auth, $("email").value.trim(), password.value); user = c.user;
    }
    if (user && !user.emailVerified) await sendEmailVerification(user);
    else { showToast("Sign in with your email and password first, then resend verification.", ""); return; }
    showToast("Verification email sent again.", "success");
  } catch (e) { showToast(friendlyError(e), "error"); }
});
$("back-login-btn").addEventListener("click", () => { showAuth(); setMode("login"); });
$("continue-btn").addEventListener("click", () => { window.location.href = PDF_TOOLS_URL; });
$("logout-btn").addEventListener("click", async () => { try { await signOut(auth); setMode("login"); showAuth(); } catch(e) { showToast(friendlyError(e), "error"); } });

// ----- Procedural Three.js mascot: no GLB asset required -----
async function initMascot() {
  const canvas = $("mascot-canvas");
  try {
    const THREE = await import("https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js");
    const gsapModule = await import("https://cdn.jsdelivr.net/npm/gsap@3.12.5/index.js");
    const gsap = gsapModule.gsap || gsapModule.default;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, canvas.clientWidth / canvas.clientHeight, .1, 100);
    camera.position.set(0, 1.4, 8);
    const renderer = new THREE.WebGLRenderer({canvas, alpha:true, antialias:true});
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene.add(new THREE.HemisphereLight(0xb9d7ff, 0x251345, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 3.1); key.position.set(-3,5,6); scene.add(key);
    const rim = new THREE.PointLight(0x7a5bff, 25, 12); rim.position.set(3,2,2); scene.add(rim);
    const cyan = new THREE.PointLight(0x4be5ee, 18, 10); cyan.position.set(-3,0,2); scene.add(cyan);
    const bot = new THREE.Group(); scene.add(bot);
    const mat = (color, metalness=.25, roughness=.28) => new THREE.MeshStandardMaterial({color,metalness,roughness});
    const shell = mat(0xc9d8ff,.45,.22), dark = mat(0x22294d,.35,.3), violet = mat(0x8664ed,.4,.22), cyanMat=mat(0x67e9ed,.35,.2);
    const eyeMat = new THREE.MeshStandardMaterial({color:0x182143,roughness:.2});
    function sphere(parent, scale, material, pos) { const m=new THREE.Mesh(new THREE.SphereGeometry(1,32,24),material);m.scale.set(...scale);m.position.set(...pos);parent.add(m);return m; }
    function capsule(parent, a,b,r, material) {
      const dir=new THREE.Vector3().subVectors(b,a); const mesh=new THREE.Mesh(new THREE.CapsuleGeometry(r,Math.max(.01,dir.length()-2*r),6,12),material);
      mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());parent.add(mesh);return mesh;
    }
    // Hovering feet/body
    sphere(bot,[.58,.67,.42],shell,[0,.15,0]);
    sphere(bot,[.48,.12,.36],violet,[0,-.35,.02]);
    sphere(bot,[.61,.51,.47],shell,[0,1.05,0]);
    sphere(bot,[.57,.47,.45],dark,[0,1.05,.045]);
    sphere(bot,[.52,.42,.42],shell,[0,1.09,.09]);
    // face glass + eyes
    sphere(bot,[.43,.31,.035],dark,[0,1.12,.47]);
    const eyeL=sphere(bot,[.065,.09,.035],cyanMat,[-.17,1.13,.51]);
    const eyeR=sphere(bot,[.065,.09,.035],cyanMat,[.17,1.13,.51]);
    const mouth=sphere(bot,[.075,.022,.018],violet,[0,.94,.52]);
    // ear discs
    sphere(bot,[.11,.17,.12],violet,[-.62,1.08,0]); sphere(bot,[.11,.17,.12],violet,[.62,1.08,0]);
    // antenna
    capsule(bot,new THREE.Vector3(0,1.55,0),new THREE.Vector3(0,1.78,0),.025,violet);
    sphere(bot,[.08,.08,.08],cyanMat,[0,1.82,0]);
    // arms pivot
    const armL=new THREE.Group();armL.position.set(-.55,.48,0);bot.add(armL);
    capsule(armL,new THREE.Vector3(0,0,0),new THREE.Vector3(-.18,-.32,.02),.105,shell);
    sphere(armL,[.13,.13,.13],violet,[-.18,-.32,.02]);
    const armR=new THREE.Group();armR.position.set(.55,.48,0);bot.add(armR);
    capsule(armR,new THREE.Vector3(0,0,0),new THREE.Vector3(.18,-.32,.02),.105,shell);
    sphere(armR,[.13,.13,.13],violet,[.18,-.32,.02]);
    const legL=new THREE.Group();legL.position.set(-.27,-.38,0);bot.add(legL);
    capsule(legL,new THREE.Vector3(0,0,0),new THREE.Vector3(0,-.25,0),.12,dark);
    sphere(legL,[.18,.09,.24],violet,[0,-.28,.08]);
    const legR=new THREE.Group();legR.position.set(.27,-.38,0);bot.add(legR);
    capsule(legR,new THREE.Vector3(0,0,0),new THREE.Vector3(0,-.25,0),.12,dark);
    sphere(legR,[.18,.09,.24],violet,[0,-.28,.08]);
    // soft floating platform
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.8,.012,8,80),new THREE.MeshBasicMaterial({color:0x7c70ff,transparent:true,opacity:.55}));
    ring.rotation.x=Math.PI/2;ring.position.y=-.73;bot.add(ring);
    bot.scale.setScalar(.84); bot.position.set(-.2,-.18,0);
    let mood="idle", t=0, blink=0;
    const resize=()=>{const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);};
    new ResizeObserver(resize).observe(canvas); resize();
    window.auroraMascot={
      setMood(next){mood=next;if(next==="happy"){gsap.to(armR.rotation,{z:-2.3,duration:.35});gsap.to(bot.position,{y:.05,duration:.3,yoyo:true,repeat:3});}
      else if(next==="sad"){gsap.to(armL.rotation,{z:.6,duration:.3});gsap.to(armR.rotation,{z:-.6,duration:.3});}
      else if(next==="shy"){gsap.to(armL.rotation,{z:1.6,duration:.3});gsap.to(armR.rotation,{z:-1.6,duration:.3});}
      else if(next==="peek"){gsap.to(armR.rotation,{z:-.7,duration:.3});}
      else {gsap.to(armL.rotation,{z:0,duration:.3});gsap.to(armR.rotation,{z:0,duration:.3});}}
    };
    // Walk-in + welcome wave
    bot.position.x=-1.25; gsap.to(bot.position,{x:-.2,duration:1.25,ease:"power2.out",delay:.2});
    gsap.to(armR.rotation,{z:-2.25,duration:.35,delay:1.15,yoyo:true,repeat:3,ease:"sine.inOut"});
    const clock=new THREE.Clock();
    function animate(){requestAnimationFrame(animate);const dt=clock.getDelta();t+=dt;
      bot.position.y=-.18+Math.sin(t*1.7)*.045;bot.rotation.y=Math.sin(t*.7)*.1;
      if(mood==="idle"){eyeL.scale.y=.09;eyeR.scale.y=.09;}
      else if(mood==="shy"){eyeL.scale.y=.018;eyeR.scale.y=.018;}
      if(Math.sin(t*1.3)>0.997 && t-blink>.4){blink=t;gsap.to([eyeL.scale,eyeR.scale],{y:.012,duration:.08,yoyo:true,repeat:1});}
      renderer.render(scene,camera);
    } animate();
  } catch (e) {
    canvas.style.display="none";
    const fallback=document.createElement("div");fallback.className="mascot-fallback";fallback.textContent="✦";canvas.parentElement.appendChild(fallback);
    console.warn("3D assistant could not load:",e);
  }
}
initMascot();
