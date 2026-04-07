import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Konfigurasi Firebase (HARUS SAMA PERSIS dengan di landing.js)
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

// Proteksi Halaman: Jika belum login, tendang ke index.html
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "landing.html"; // Ganti dengan nama file utamamu jika berbeda
        return;
    }

    // 1. Tampilkan Data Basic (Auth)
    const userName = user.displayName || "Member Lumina";
    document.getElementById("profile-name").innerText = userName;
    document.getElementById("profile-email").innerText = user.email;
    document.getElementById("profile-initial").innerText = userName.charAt(0).toUpperCase();

    // 2. Ambil Data Tambahan (No HP & Alamat) dari Firestore 'users'
    try {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            document.getElementById("profile-phone").innerText = userData.phone || "Belum ada no telepon";
            document.getElementById("profile-address").innerText = userData.address || "Belum ada alamat";
        } else {
            document.getElementById("profile-phone").innerText = "-";
            document.getElementById("profile-address").innerText = "Data tidak ditemukan di sistem.";
        }
    } catch (error) {
        console.error("Gagal mengambil profil:", error);
    }

    // 3. Ambil Riwayat Transaksi dari Firestore 'sales'
    fetchOrderHistory(user.uid);
});

// Fungsi Menarik Riwayat Transaksi
async function fetchOrderHistory(userId) {
    const historyContainer = document.getElementById("order-history");
    
    try {
        // Query: Cari di tabel "sales" di mana "userId" sama dengan ID user yang login
        const salesRef = collection(db, "sales");
        const q = query(salesRef, where("userId", "==", userId));
        const querySnapshot = await getDocs(q);

        historyContainer.innerHTML = ""; // Bersihkan loading

        if (querySnapshot.empty) {
            historyContainer.innerHTML = `
                <div class="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <i class="fas fa-box-open text-4xl text-gray-300 mb-3"></i>
                    <p class="text-sm font-medium text-gray-500">Belum ada riwayat transaksi.</p>
                    <a href="landing.html" class="inline-block mt-3 text-xs text-lumina-gold font-bold hover:underline">Mulai Belanja</a>
                </div>
            `;
            return;
        }

        // Looping data transaksi yang ditemukan
        querySnapshot.forEach((doc) => {
            const sale = doc.data();
            
            // Format tanggal (Jika menggunakan timestamp Firebase)
            let dateStr = "Tanggal tidak diketahui";
            if (sale.date && sale.date.toDate) {
                dateStr = sale.date.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute:'2-digit' });
            } else if (typeof sale.date === 'string') {
                dateStr = sale.date;
            }

            // Hitung total harga
            const totalBayar = sale.total ? `Rp ${sale.total.toLocaleString('id-ID')}` : "Rp 0";

            historyContainer.innerHTML += `
                <div class="p-4 border border-gray-100 rounded-2xl hover:shadow-md transition bg-white">
                    <div class="flex justify-between items-start mb-3 border-b border-gray-50 pb-3">
                        <div>
                            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">ID Transaksi: ${doc.id.substring(0,8)}</span>
                            <span class="text-xs font-medium text-gray-600"><i class="far fa-clock mr-1"></i> ${dateStr}</span>
                        </div>
                        <span class="bg-green-100 text-green-700 text-[10px] font-bold px-3 py-1 rounded-full uppercase">Selesai</span>
                    </div>
                    
                    <div class="flex justify-between items-end">
                        <div class="text-sm text-gray-500 font-medium">
                            Total Belanja:
                        </div>
                        <div class="text-lg font-black text-lumina-dark">${totalBayar}</div>
                    </div>
                </div>
            `;
        });

    } catch (error) {
        console.error("Gagal mengambil transaksi:", error);
        historyContainer.innerHTML = `<p class="text-red-500 text-sm text-center py-4">Gagal memuat riwayat belanja.</p>`;
    }
}

// Fungsi Buka/Tutup Modal
window.toggleEditModal = () => {
    const modal = document.getElementById('edit-modal');
    modal.classList.toggle('hidden');
    modal.classList.toggle('flex');
};

// Fungsi Mengisi Data Lama ke Input Modal
window.openEditModal = async () => {
    const user = auth.currentUser;
    if (!user) return;

    // Ambil data terbaru dari Firestore
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
        const data = userDoc.data();
        document.getElementById('edit-name').value = user.displayName || "";
        document.getElementById('edit-phone').value = data.phone || "";
        document.getElementById('edit-address').value = data.address || "";
    }
    toggleEditModal();
};

// Handle Submit Form Edit
document.getElementById('edit-profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const newName = document.getElementById('edit-name').value;
    const newPhone = document.getElementById('edit-phone').value;
    const newAddress = document.getElementById('edit-address').value;

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
    submitBtn.disabled = true;

    try {
        // 1. Update Nama di Firebase Auth
        await updateProfile(user, { displayName: newName });

        // 2. Update No HP & Alamat di Firestore
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
            phone: newPhone,
            address: newAddress,
            updatedAt: new Date().toISOString()
        });

        alert("Profil berhasil diperbarui!");
        location.reload(); // Refresh untuk melihat perubahan
    } catch (error) {
        console.error("Error update profil:", error);
        alert("Gagal memperbarui profil.");
    } finally {
        submitBtn.innerHTML = 'Simpan Perubahan';
        submitBtn.disabled = false;
    }
});

// Global Fungsi Logout
window.handleLogout = async () => {
    if (confirm("Apakah Anda yakin ingin keluar dari akun Anda?")) {
        try {
            await signOut(auth);
            // Otomatis akan dilempar ke index.html karena onAuthStateChanged di atas
        } catch (error) {
            console.error("Gagal Logout:", error);
        }
    }
};