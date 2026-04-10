import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBMsUhXj-UCLLviXzweS1qXVdSaVgkDcu8",
    authDomain: "sistemkasirtokocom.firebaseapp.com",
    projectId: "sistemkasirtokocom",
    storageBucket: "sistemkasirtokocom.firebasestorage.app",
    messagingSenderId: "141722200955",
    appId: "1:141722200955:web:e07952808590aa7f582bde",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ================= AUTH =================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "landing.html";
        return;
    }

    const userName = user.displayName || "Member Lumina";
    document.getElementById("profile-name").innerText = userName;
    document.getElementById("profile-email").innerText = user.email;
    document.getElementById("profile-initial").innerText = userName.charAt(0).toUpperCase();

    // ambil data tambahan
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
        const data = userDoc.data();
        document.getElementById("profile-phone").innerText = data.phone || "-";
        document.getElementById("profile-address").innerText = data.address || "-";
    }

    fetchOrderHistory(user.uid);
});

// ================= FETCH TRANSAKSI =================
async function fetchOrderHistory(userId) {
    const container = document.getElementById("order-history");

    const q = query(collection(db, "sales"), where("userId", "==", userId));
    const snapshot = await getDocs(q);

    container.innerHTML = "";

    if (snapshot.empty) {
        container.innerHTML = `<p class="text-center text-gray-500">Belum ada transaksi</p>`;
        return;
    }

    snapshot.forEach((docSnap) => {
        const data = docSnap.data();

        const total = `Rp ${data.total?.toLocaleString("id-ID") || 0}`;

        let statusClass = "";
        let statusText = "";

        if (data.status === "pending") {
            statusClass = "bg-yellow-100 text-yellow-700";
            statusText = "Menunggu";
        } else if (data.status === "success") {
            statusClass = "bg-green-100 text-green-700";
            statusText = "Sukses";
        } else {
            statusClass = "bg-red-100 text-red-700";
            statusText = "Gagal";
        }

        let bayarButton = "";
        if (data.status === "pending" && data.snapToken) {
            bayarButton = `
                <button 
                  onclick="payAgain('${data.snapToken}')"
                  class="mt-2 px-3 py-1 bg-black text-white text-xs rounded"
                >
                  Bayar Lagi
                </button>
            `;
        }

        container.innerHTML += `
            <div class="p-4 border rounded-xl bg-white">
                <div class="flex justify-between">
                    <div>
                        <p class="text-xs text-gray-400">ID: ${data.orderId}</p>
                        <p class="text-sm font-medium">${total}</p>
                    </div>
                    <div class="text-right">
                        <span class="${statusClass} text-xs px-2 py-1 rounded-full font-bold">
                            ${statusText}
                        </span>
                        ${bayarButton}
                    </div>
                </div>
            </div>
        `;
    });
}

// ================= BAYAR LAGI =================
window.payAgain = function (token) {
    if (!token) {
        alert("Snap token tidak ditemukan!");
        return;
    }

    window.snap.pay(token, {
        onSuccess: function () {
            alert("Pembayaran berhasil!");
            location.reload();
        },
        onPending: function () {
            alert("Masih menunggu pembayaran");
        },
        onError: function () {
            alert("Pembayaran gagal");
        }
    });
};

// ================= EDIT PROFILE =================
window.toggleEditModal = () => {
    const modal = document.getElementById('edit-modal');
    modal.classList.toggle('hidden');
    modal.classList.toggle('flex');
};

window.openEditModal = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
        const data = userDoc.data();
        document.getElementById('edit-name').value = user.displayName || "";
        document.getElementById('edit-phone').value = data.phone || "";
        document.getElementById('edit-address').value = data.address || "";
    }

    toggleEditModal();
};

document.getElementById('edit-profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const user = auth.currentUser;

    const newName = document.getElementById('edit-name').value;
    const newPhone = document.getElementById('edit-phone').value;
    const newAddress = document.getElementById('edit-address').value;

    await updateProfile(user, { displayName: newName });

    await updateDoc(doc(db, "users", user.uid), {
        phone: newPhone,
        address: newAddress
    });

    alert("Profil berhasil diupdate");
    location.reload();
});

// ================= LOGOUT =================
window.handleLogout = async () => {
    await signOut(auth);
};