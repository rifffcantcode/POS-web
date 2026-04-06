import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, where, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBMsUhXj-UCLLviXzweS1qXVdSaVgkDcu8",
    authDomain: "sistemkasirtokocom.firebaseapp.com",
    projectId: "sistemkasirtokocom",
    storageBucket: "sistemkasirtokocom.firebasestorage.app",
    messagingSenderId: "141722200955",
    appId: "1:141722200955:web:e07952808590aa7f582bde"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Cek Status Login
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('user-email').innerText = user.email;
        loadUserHistory(user.uid);
    } else {
        alert("Silakan login terlebih dahulu!");
        window.location.href = "login.html"; // Arahkan ke login jika tidak ada user
    }
});

function loadUserHistory(uid) {
    // Ambil data sales yang userId-nya sama dengan user yang login
    const q = query(
        collection(db, "sales"),
        where("userId", "==", uid),
        orderBy("timestamp", "desc")
    );

    onSnapshot(q, (snapshot) => {
        const historyContainer = document.getElementById('history-list');
        let totalSpentVal = 0;
        let html = "";

        if (snapshot.empty) {
            historyContainer.innerHTML = `<p class="p-10 text-center text-slate-500">Belum ada riwayat transaksi.</p>`;
            return;
        }

        snapshot.forEach((doc) => {
            const data = doc.data();
            totalSpentVal += data.totalPrice;

            // Format tanggal
            const date = data.timestamp ? data.timestamp.toDate().toLocaleString('id-ID') : 'Pending...';

            html += `
            <div class="p-5 hover:bg-slate-700 transition">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <span class="text-xs font-mono text-yellow-500">ID: ${doc.id.substring(0,8)}...</span>
                        <p class="text-sm text-slate-400">${date}</p>
                    </div>
                    <p class="font-bold text-white text-lg">Rp ${data.totalPrice.toLocaleString()}</p>
                </div>
                <div class="text-xs text-slate-300">
                    ${data.items.map(item => `${item.name} (${item.qty})`).join(', ')}
                </div>
            </div>`;
        });

        historyContainer.innerHTML = html;
        document.getElementById('total-spent').innerText = `Rp ${totalSpentVal.toLocaleString()}`;
        document.getElementById('trx-count').innerText = snapshot.size;
    });
}