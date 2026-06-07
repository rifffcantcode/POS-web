import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, updateDoc, deleteDoc} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { showPopup } from "./notify.js";

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
const ORDER_HISTORY_PAGE_SIZE = 5;
let orderHistoryTransactions = [];
let currentOrderHistoryPage = 1;
let currentSelectedTransaction = null;

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
  const paginationContainer = document.getElementById("order-history-pagination");

  try {
    const salesRef = collection(db, "sales");
    const q = query(salesRef, where("userId", "==", userId));
    const querySnapshot = await getDocs(q);

    historyContainer.innerHTML = "";
    if (paginationContainer) paginationContainer.innerHTML = "";

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

    orderHistoryTransactions = [...transactions].sort((a, b) => getTransactionMillis(b) - getTransactionMillis(a));
    currentOrderHistoryPage = 1;
    renderOrderHistoryPage();
  } catch (error) {
    console.error("Gagal mengambil transaksi:", error);
    historyContainer.innerHTML = `
      <p class="text-red-500 text-sm text-center py-4">
        Gagal memuat riwayat belanja.
      </p>
    `;
    if (paginationContainer) paginationContainer.innerHTML = "";
  }
}

function getTransactionMillis(sale) {
  if (sale?.createdAt?.toMillis) return sale.createdAt.toMillis();
  if (sale?.createdAt?.toDate) return sale.createdAt.toDate().getTime();
  if (typeof sale?.createdAt === "string") {
    const parsed = new Date(sale.createdAt).getTime();
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

function buildTransactionCard(sale) {
  let dateStr = "Tanggal tidak diketahui";
  if (sale.createdAt && sale.createdAt.toDate) {
    dateStr = sale.createdAt.toDate().toLocaleString("id-ID");
  } else if (typeof sale.createdAt === "string") {
    const parsed = new Date(sale.createdAt);
    if (!Number.isNaN(parsed.getTime())) {
      dateStr = parsed.toLocaleString("id-ID");
    }
  }

  const totalBayar = sale.total ? `Rp ${Number(sale.total).toLocaleString("id-ID")}` : "Rp 0";

  let statusBadge = "";
  if (sale.status === "success") {
    statusBadge = `<span class="bg-green-100 text-green-700 text-[10px] font-bold px-3 py-1 rounded-full uppercase">Sukses</span>`;
  } else if (sale.status === "pending") {
    statusBadge = `<span class="bg-yellow-100 text-yellow-700 text-[10px] font-bold px-3 py-1 rounded-full uppercase">Pending</span>`;
  } else {
    statusBadge = `<span class="bg-red-100 text-red-700 text-[10px] font-bold px-3 py-1 rounded-full uppercase">Gagal</span>`;
  }

  let actionButtons = "";
  if (sale.status === "pending") {
    actionButtons = `
      <button onclick="payAgain('${sale.snapToken}')" class="text-xs bg-black text-white px-3 py-1 rounded mr-2">
        Bayar Lagi
      </button>
      <button onclick="cancelTransaction('${sale.id}')" class="text-xs bg-red-500 text-white px-3 py-1 rounded">
        Batalkan
      </button>
    `;
  } else if (sale.status === "failed") {
    actionButtons = `
      <button onclick="deleteTransaction('${sale.id}')" class="text-xs bg-gray-500 text-white px-3 py-1 rounded">
        Hapus
      </button>
    `;
  }

  return `
    <div class="p-4 border border-gray-100 rounded-2xl hover:shadow-md transition bg-white cursor-pointer" onclick="openTransactionDetail('${sale.id}')">
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
        <div class="text-sm text-gray-500 font-medium">Total Belanja:</div>
        <div class="text-lg font-black text-lumina-dark">${totalBayar}</div>
      </div>
      <div class="mt-3">${actionButtons}</div>
    </div>
  `;
}

function renderOrderHistoryPage() {
  const historyContainer = document.getElementById("order-history");
  const paginationContainer = document.getElementById("order-history-pagination");
  if (!historyContainer) return;

  if (!orderHistoryTransactions.length) {
    historyContainer.innerHTML = `
      <div class="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
        <i class="fas fa-box-open text-4xl text-gray-300 mb-3"></i>
        <p class="text-sm font-medium text-gray-500">Belum ada riwayat transaksi.</p>
      </div>
    `;
    if (paginationContainer) paginationContainer.innerHTML = "";
    return;
  }

  const totalPages = Math.ceil(orderHistoryTransactions.length / ORDER_HISTORY_PAGE_SIZE);
  currentOrderHistoryPage = Math.min(Math.max(currentOrderHistoryPage, 1), totalPages);

  const start = (currentOrderHistoryPage - 1) * ORDER_HISTORY_PAGE_SIZE;
  const end = start + ORDER_HISTORY_PAGE_SIZE;
  const pageItems = orderHistoryTransactions.slice(start, end);
  historyContainer.innerHTML = pageItems.map(buildTransactionCard).join("");

  if (!paginationContainer) return;
  if (totalPages <= 1) {
    paginationContainer.innerHTML = "";
    return;
  }

  const pageButtons = generateCompactPagination(totalPages, currentOrderHistoryPage);

  paginationContainer.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-xs text-gray-400 font-medium">
        Menampilkan ${start + 1}-${Math.min(end, orderHistoryTransactions.length)} dari ${orderHistoryTransactions.length} transaksi
      </p>
      <div class="flex flex-wrap items-center gap-2">
        <button onclick="changeOrderHistoryPage(${currentOrderHistoryPage - 1})"
          class="h-9 px-3 rounded-lg text-xs font-bold border border-gray-200 bg-white text-gray-600 hover:border-lumina-dark hover:text-lumina-dark transition ${currentOrderHistoryPage === 1 ? "opacity-50 pointer-events-none" : ""}">
          Prev
        </button>
        ${pageButtons}
        <button onclick="changeOrderHistoryPage(${currentOrderHistoryPage + 1})"
          class="h-9 px-3 rounded-lg text-xs font-bold border border-gray-200 bg-white text-gray-600 hover:border-lumina-dark hover:text-lumina-dark transition ${currentOrderHistoryPage === totalPages ? "opacity-50 pointer-events-none" : ""}">
          Next
        </button>
      </div>
    </div>
  `;
}

window.changeOrderHistoryPage = function(page) {
  const totalPages = Math.max(Math.ceil(orderHistoryTransactions.length / ORDER_HISTORY_PAGE_SIZE), 1);
  currentOrderHistoryPage = Math.min(Math.max(page, 1), totalPages);
  renderOrderHistoryPage();
};

function generateCompactPagination(totalPages, currentPage) {
  const createButton = (page, isActive = false) => `
    <button onclick="changeOrderHistoryPage(${page})"
      class="w-9 h-9 rounded-lg text-xs font-bold border transition ${isActive ? "bg-lumina-dark text-lumina-gold border-lumina-dark" : "bg-white text-gray-600 border-gray-200 hover:border-lumina-dark hover:text-lumina-dark"}">
      ${page}
    </button>
  `;

  const buttons = [];

  if (totalPages <= 7) {
    for (let page = 1; page <= totalPages; page += 1) {
      buttons.push(createButton(page, page === currentPage));
    }
    return buttons.join("");
  }

  const pushEllipsis = () => buttons.push(`<span class="px-2 text-xs text-gray-400">...</span>`);

  if (currentPage <= 4) {
    for (let page = 1; page <= 5; page += 1) {
      buttons.push(createButton(page, page === currentPage));
    }
    pushEllipsis();
    buttons.push(createButton(totalPages));
    return buttons.join("");
  }

  if (currentPage >= totalPages - 3) {
    buttons.push(createButton(1));
    pushEllipsis();
    for (let page = totalPages - 4; page <= totalPages; page += 1) {
      buttons.push(createButton(page, page === currentPage));
    }
    return buttons.join("");
  }

  buttons.push(createButton(1));
  pushEllipsis();
  for (let page = currentPage - 1; page <= currentPage + 1; page += 1) {
    buttons.push(createButton(page, page === currentPage));
  }
  pushEllipsis();
  buttons.push(createButton(totalPages));
  return buttons.join("");
}

// ================= BAYAR LAGI =================
window.payAgain = function (token) {
  if (!token) {
    showPopup("Snap token tidak ditemukan!");
    return;
  }

  window.snap.pay(token, {
    onSuccess: async function () {
      showPopup("Pembayaran berhasil!");

      try {
        await fetch("https://lumina-kz2q.onrender.com/update-status-by-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token: token,
            status: "success",
          }),
        });
      } catch (err) {
        console.error("Gagal update status:", err);
      }

      localStorage.removeItem("lumina_cart");

      if (typeof cart !== "undefined") {
        cart = [];
      }
      if (typeof renderCart === "function") {
        renderCart();
      }

      location.reload();
    },

    onPending: function () {
      showPopup("Masih menunggu pembayaran");
    },

    onError: function () {
      showPopup("Pembayaran gagal");
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

    showPopup("Transaksi dibatalkan");

    location.reload();
  } catch (err) {
    console.error("ERROR CANCEL:", err);
    showPopup("Gagal cancel: " + err.message);
  }
};
// ================= Delete Transaction =================
window.deleteTransaction = async (id) => {
  console.log("DELETE ID:", id);

  if (!confirm("Hapus transaksi ini?")) return;

  try {
    await deleteDoc(doc(db, "sales", id));

    console.log("Berhasil dihapus");

    showPopup("Transaksi dihapus");
    location.reload();
  } catch (err) {
    console.error("ERROR DELETE:", err);
    showPopup("Gagal hapus: " + err.message);
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

    showPopup("Profil berhasil diupdate");
    location.reload();
});

// ================= TRANSACTION DETAIL =================
window.toggleTransactionModal = () => {
    const modal = document.getElementById('transaction-detail-modal');
    if (modal) {
        modal.classList.toggle('hidden');
        modal.classList.toggle('flex');
    }
};

window.openTransactionDetail = (transactionId) => {
    const transaction = orderHistoryTransactions.find(t => t.id === transactionId);
    
    if (!transaction) {
        showPopup("Transaksi tidak ditemukan");
        return;
    }

    currentSelectedTransaction = transaction;
    
    // Format date
    let dateStr = "Tanggal tidak diketahui";
    if (transaction.createdAt && transaction.createdAt.toDate) {
        dateStr = transaction.createdAt.toDate().toLocaleString("id-ID");
    } else if (typeof transaction.createdAt === "string") {
        const parsed = new Date(transaction.createdAt);
        if (!Number.isNaN(parsed.getTime())) {
            dateStr = parsed.toLocaleString("id-ID");
        }
    }

    // Format amount
    const totalBayar = transaction.total ? `Rp ${Number(transaction.total).toLocaleString("id-ID")}` : "Rp 0";

    // Status badge
    let statusClass = "bg-gray-100 text-gray-700";
    let statusText = "Tidak Diketahui";
    
    if (transaction.status === "success") {
        statusClass = "bg-green-100 text-green-700";
        statusText = "Berhasil";
    } else if (transaction.status === "pending") {
        statusClass = "bg-yellow-100 text-yellow-700";
        statusText = "Menunggu Pembayaran";
    } else if (transaction.status === "failed") {
        statusClass = "bg-red-100 text-red-700";
        statusText = "Gagal";
    }

    // Items details
    let itemsHTML = "";
    if (transaction.items && Array.isArray(transaction.items) && transaction.items.length > 0) {
        itemsHTML = transaction.items.map((item, idx) => `
            <div class="flex justify-between items-start pb-3 border-b border-gray-100 last:border-b-0 last:pb-0">
                <div>
                    <p class="text-sm font-medium text-gray-800">${item.name || "Produk"}</p>
                    <p class="text-xs text-gray-500">Qty: ${item.quantity || 1}</p>
                </div>
                <p class="text-sm font-bold text-lumina-dark">Rp ${Number(item.price || 0).toLocaleString("id-ID")}</p>
            </div>
        `).join("");
    } else {
        itemsHTML = '<p class="text-sm text-gray-500">Tidak ada detail item</p>';
    }

    // Populate modal
    document.getElementById('detail-transaction-id').innerText = transaction.id;
    document.getElementById('detail-transaction-date').innerText = dateStr;
    document.getElementById('detail-transaction-status').innerHTML = `<span class="px-3 py-1 rounded-full text-xs font-bold ${statusClass}">${statusText.toUpperCase()}</span>`;
    document.getElementById('detail-transaction-items').innerHTML = itemsHTML;
    document.getElementById('detail-transaction-total').innerText = totalBayar;

    // Handle payment methods if available
    if (transaction.paymentMethod) {
        document.getElementById('detail-payment-method').innerText = transaction.paymentMethod;
    }

    toggleTransactionModal();
};

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