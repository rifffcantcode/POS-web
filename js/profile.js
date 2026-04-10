import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, updateDoc, deleteDoc} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
  const historyContainer = document.getElementById("order-history");

  try {
    const salesRef = collection(db, "sales");
    const q = query(salesRef, where("userId", "==", userId));
    const querySnapshot = await getDocs(q);

    historyContainer.innerHTML = "";

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

    const transactions = [];

    querySnapshot.forEach((docSnap) => {
      transactions.push({
        id: docSnap.id,
        ...docSnap.data(),
      });
    });

    // =========================
    // 🔥 AUTO EXPIRE CHECK
    // =========================
    const now = Date.now();

    for (const trx of transactions) {
      if (trx.status === "pending" && trx.expiredAt && now > trx.expiredAt) {
        try {
          await updateDoc(doc(db, "sales", trx.id), {
            status: "failed",
          });
          trx.status = "failed";
        } catch (err) {
          console.error("Gagal update expired:", err);
        }
      }
    }

    // =========================
    // 🔄 RENDER DATA
    // =========================
    transactions.reverse().forEach((sale) => {
      // FORMAT TANGGAL
      let dateStr = "Tanggal tidak diketahui";
      if (sale.date && sale.date.toDate) {
        dateStr = sale.date.toDate().toLocaleString("id-ID");
      } else if (sale.createdAt) {
        dateStr = new Date(sale.createdAt).toLocaleString("id-ID");
      }

      const totalBayar = sale.total
        ? `Rp ${sale.total.toLocaleString("id-ID")}`
        : "Rp 0";

      // =========================
      // 🎨 STATUS BADGE
      // =========================
      let statusBadge = "";
      if (sale.status === "success") {
        statusBadge = `<span class="bg-green-100 text-green-700 text-[10px] font-bold px-3 py-1 rounded-full uppercase">Sukses</span>`;
      } else if (sale.status === "pending") {
        statusBadge = `<span class="bg-yellow-100 text-yellow-700 text-[10px] font-bold px-3 py-1 rounded-full uppercase">Pending</span>`;
      } else {
        statusBadge = `<span class="bg-red-100 text-red-700 text-[10px] font-bold px-3 py-1 rounded-full uppercase">Gagal</span>`;
      }

      // =========================
      // 🔘 ACTION BUTTONS
      // =========================
      let actionButtons = "";

      if (sale.status === "pending") {
        actionButtons = `
          <button onclick="payAgain('${sale.snapToken}')" 
            class="text-xs bg-black text-white px-3 py-1 rounded mr-2">
            Bayar Lagi
          </button>

          <button onclick="cancelTransaction('${sale.id}')" 
            class="text-xs bg-red-500 text-white px-3 py-1 rounded">
            Batalkan
          </button>
        `;
      }

      if (sale.status === "failed") {
        actionButtons = `
          <button onclick="deleteTransaction('${sale.id}')" 
            class="text-xs bg-gray-500 text-white px-3 py-1 rounded">
            Hapus
          </button>
        `;
      }

      // =========================
      // 🧩 RENDER CARD
      // =========================
      historyContainer.innerHTML += `
        <div class="p-4 border border-gray-100 rounded-2xl hover:shadow-md transition bg-white">
          
          <div class="flex justify-between items-start mb-3 border-b border-gray-50 pb-3">
            <div>
              <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                ID Transaksi: ${sale.id.substring(0, 8)}
              </span>
              <span class="text-xs font-medium text-gray-600">
                <i class="far fa-clock mr-1"></i> ${dateStr}
              </span>
            </div>
            ${statusBadge}
          </div>
          
          <div class="flex justify-between items-end">
            <div class="text-sm text-gray-500 font-medium">
              Total Belanja:
            </div>
            <div class="text-lg font-black text-lumina-dark">
              ${totalBayar}
            </div>
          </div>

          <div class="mt-3">
            ${actionButtons}
          </div>

        </div>
      `;
    });

  } catch (error) {
    console.error("Gagal mengambil transaksi:", error);
    historyContainer.innerHTML = `
      <p class="text-red-500 text-sm text-center py-4">
        Gagal memuat riwayat belanja.
      </p>
    `;
  }
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

// ================= Cancel Transaction =================
window.cancelTransaction = async (id) => {
  console.log("Cancel ID:", id);

  if (!confirm("Batalkan transaksi ini?")) return;

  try {
    const trxRef = doc(db, "sales", id);

    await updateDoc(trxRef, {
      status: "failed",
    });

    console.log("Berhasil update ke failed");

    alert("Transaksi dibatalkan");

    location.reload();
  } catch (err) {
    console.error("ERROR CANCEL:", err);
    alert("Gagal cancel: " + err.message);
  }
};
// ================= Delete Transaction =================
window.deleteTransaction = async (id) => {
  console.log("DELETE ID:", id);

  if (!confirm("Hapus transaksi ini?")) return;

  try {
    await deleteDoc(doc(db, "sales", id));

    console.log("Berhasil dihapus");

    alert("Transaksi dihapus");
    location.reload();
  } catch (err) {
    console.error("ERROR DELETE:", err);
    alert("Gagal hapus: " + err.message);
  }
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

async function updateExpiredTransactions(transactions) {
  const now = Date.now();

  for (const trx of transactions) {
    if (trx.status === "pending" && trx.expiredAt && now > trx.expiredAt) {
      try {
        const trxRef = doc(db, "sales", trx.id);

        await updateDoc(trxRef, {
          status: "failed"
        });

        console.log("Transaksi expired:", trx.id);
      } catch (err) {
        console.error("Gagal update expired:", err);
      }
    }
  }
}

// ================= LOGOUT =================
window.handleLogout = async () => {
    await signOut(auth);
};