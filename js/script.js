import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// 1. KONFIGURASI FIREBASE
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyBMsUhXj-UCLLviXzweS1qXVdSaVgkDcu8",
  authDomain: "sistemkasirtokocom.firebaseapp.com",
  projectId: "sistemkasirtokocom",
  storageBucket: "sistemkasirtokocom.firebasestorage.app",
  messagingSenderId: "141722200955",
  appId: "1:141722200955:web:e07952808590aa7f582bde",
  measurementId: "G-6ZCKQ49GFY"
};

// Inisialisasi
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const productsRef = collection(db, "products");
const transactionsRef = collection(db, "transactions");

// STATE VARIABLES
let allProducts = [];
let cart = [];
let isCategoryInputMode = false; // False = Select Mode, True = Text Input Mode

// ==========================================
// 2. MAIN LOAD FUNCTIONS (REALTIME)
// ==========================================

// Load Produk Realtime
onSnapshot(productsRef, (snapshot) => {
  allProducts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  renderProductGrid(allProducts);
  renderInventoryTable(allProducts); // Render awal tabel inventaris
  renderCategoryFilters(); 
  loadCategoriesIntoSelect(); 
});

// Render Grid Produk (Halaman Kasir)
function renderProductGrid(products) {
  const grid = document.getElementById("product-list");
  if (!grid) return;
  
  grid.innerHTML = "";

  products.forEach((product) => {
    const card = document.createElement("div");
    card.className = "bg-white rounded-xl shadow-sm hover:shadow-md transition p-4 flex flex-col h-full border border-gray-100 cursor-pointer group";
    
    card.innerHTML = `
        <div class="h-48 w-full bg-gray-50 rounded-lg mb-4 overflow-hidden relative p-4 flex items-center justify-center group-hover:bg-gray-100 transition">
            <img src="${product.image}" alt="${product.name}" class="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition duration-300">
            
            <span class="absolute top-2 right-2 bg-white/90 backdrop-blur text-[10px] px-2 py-1 rounded-full text-gray-600 font-bold border shadow-sm">
                ${product.stock} Unit
            </span>
        </div>
        <h3 class="font-bold text-gray-800 text-sm mb-1 line-clamp-2 h-10" title="${product.name}">${product.name}</h3>
        <p class="text-xs text-gray-500 mb-3 bg-gray-100 w-fit px-2 py-1 rounded-full">${product.category}</p>
        
        <div class="mt-auto flex justify-between items-end">
            <div>
                <p class="text-[10px] text-gray-400 font-bold uppercase">Harga</p>
                <span class="font-black text-lumina-dark text-lg">Rp ${parseInt(product.price).toLocaleString("id-ID")}</span>
            </div>
            <button onclick="addToCart('${product.id}')" class="bg-lumina-dark text-white w-10 h-10 rounded-xl flex items-center justify-center hover:bg-lumina-gold hover:text-lumina-dark transition shadow-md active:scale-95">
                <i class="fas fa-plus"></i>
            </button>
        </div>
    `;
    grid.appendChild(card);
  });
}

// Render Tabel Inventaris (Di dalam Modal Kelola)
function renderInventoryTable(products) {
    const tbody = document.getElementById("inventory-table-body");
    if (!tbody) return;
    
    tbody.innerHTML = "";

    products.forEach(product => {
        const row = document.createElement("tr");
        row.className = "border-b hover:bg-gray-50 transition";
        row.innerHTML = `
            <td class="p-3 font-medium text-gray-800 text-sm">${product.name}</td>
            <td class="p-3 text-gray-500"><span class="bg-gray-100 px-2 py-1 rounded text-xs border">${product.category}</span></td>
            <td class="p-3 text-sm">Rp ${parseInt(product.price).toLocaleString()}</td>
            <td class="p-3 text-center font-bold text-sm ${product.stock < 5 ? 'text-red-500' : 'text-green-600'}">${product.stock}</td>
            <td class="p-3 text-center space-x-1">
                <button onclick="editProduct('${product.id}')" class="bg-yellow-50 text-yellow-600 p-2 rounded hover:bg-yellow-100 transition"><i class="fas fa-edit"></i></button>
                <button onclick="deleteProduct('${product.id}')" class="bg-red-50 text-red-600 p-2 rounded hover:bg-red-100 transition"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// ==========================================
// 3. KELOLA KATEGORI (DINAMIS & HAPUS)
// ==========================================

window.loadCategoriesIntoSelect = function() {
    const select = document.getElementById("product-category-select");
    if (!select) return;

    const uniqueCategories = [...new Set(allProducts.map(p => p.category))].sort();
    const currentValue = select.value;

    select.innerHTML = '<option value="">Pilih Kategori...</option>';
    uniqueCategories.forEach(cat => {
        if(cat && cat !== "Uncategorized") {
            select.innerHTML += `<option value="${cat}">${cat}</option>`;
        }
    });
    select.innerHTML += `<option value="Uncategorized">Uncategorized</option>`;

    if(currentValue) select.value = currentValue;
    checkCategorySelection();
}

window.renderCategoryFilters = function() {
    const container = document.getElementById("category-filters");
    if (!container) return;

    const uniqueCategories = ["Semua", ...new Set(allProducts.map(p => p.category))].sort();
    
    container.innerHTML = uniqueCategories.map(cat => `
        <button onclick="filterGridByCategory('${cat}')" 
        class="whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold border transition transform active:scale-95
        ${cat === 'Semua' ? 'bg-lumina-dark text-white border-lumina-dark' : 'bg-white text-gray-500 border-gray-200 hover:border-lumina-dark hover:text-lumina-dark'}">
        ${cat}
        </button>
    `).join("");
}

window.toggleCategoryMode = function() {
    isCategoryInputMode = !isCategoryInputMode;
    const selectWrapper = document.getElementById("cat-select-wrapper");
    const inputWrapper = document.getElementById("cat-input-wrapper");
    const toggleBtn = document.getElementById("toggle-cat-btn");
    const deleteBtn = document.getElementById("btn-delete-cat");

    if (isCategoryInputMode) {
        selectWrapper.classList.add("hidden");
        deleteBtn.classList.add("hidden");
        inputWrapper.classList.remove("hidden");
        toggleBtn.innerText = "Batal";
        toggleBtn.classList.replace("text-lumina-gold", "text-red-500");
        document.getElementById("product-category-input").focus();
    } else {
        selectWrapper.classList.remove("hidden");
        inputWrapper.classList.add("hidden");
        toggleBtn.innerText = "+ Tambah Baru";
        toggleBtn.classList.replace("text-red-500", "text-lumina-gold");
        document.getElementById("product-category-input").value = ""; 
        checkCategorySelection();
    }
}

window.checkCategorySelection = function() {
    const select = document.getElementById("product-category-select");
    const btnDel = document.getElementById("btn-delete-cat");
    
    if (select && select.value && select.value !== "Uncategorized") {
        btnDel.classList.remove("hidden");
    } else if (btnDel) {
        btnDel.classList.add("hidden");
    }
}

window.deleteCategory = async function() {
    const select = document.getElementById("product-category-select");
    const categoryName = select.value;

    if (!categoryName) return;

    const productsInCat = allProducts.filter(p => p.category === categoryName);
    
    const confirmMsg = `Yakin ingin menghapus kategori "${categoryName}"?\n\n` + 
                       `Ada ${productsInCat.length} produk dalam kategori ini.\n` +
                       `Produk akan dipindahkan ke kategori "Uncategorized".`;

    if (!confirm(confirmMsg)) return;

    try {
        const btnDel = document.getElementById("btn-delete-cat");
        btnDel.innerText = "...";
        
        const updatePromises = productsInCat.map(product => {
            const productRef = doc(db, "products", product.id);
            return updateDoc(productRef, { category: "Uncategorized" });
        });

        await Promise.all(updatePromises);
        alert("Kategori berhasil dihapus!");
        resetForm();
        
    } catch (error) {
        console.error("Error deleting category:", error);
        alert("Gagal menghapus kategori.");
    }
}

// ==========================================
// 4. CRUD PRODUCT
// ==========================================

window.saveProduct = async function() {
    const id = document.getElementById("product-id").value;
    const name = document.getElementById("product-name").value;
    const price = document.getElementById("product-price").value;
    const stock = document.getElementById("product-stock").value;
    const image = document.getElementById("product-image").value;
    
    let category = "";
    if (isCategoryInputMode) {
        category = document.getElementById("product-category-input").value.trim();
        if(category) category = category.charAt(0).toUpperCase() + category.slice(1);
    } else {
        category = document.getElementById("product-category-select").value;
    }

    if (!name || !price || !stock || !category) {
        alert("Mohon lengkapi semua data!");
        return;
    }

    const productData = {
        name,
        category, 
        price: Number(price),
        stock: Number(stock),
        image: image || "https://via.placeholder.com/150"
    };

    try {
        if (id) {
            await updateDoc(doc(db, "products", id), productData);
        } else {
            await addDoc(productsRef, productData);
        }
        resetForm();
        alert("Produk berhasil disimpan!");
    } catch (error) {
        console.error("Error:", error);
        alert("Gagal menyimpan produk.");
    }
}

window.editProduct = function(id) {
    const product = allProducts.find(p => p.id === id);
    if (!product) return;

    document.getElementById("product-id").value = product.id;
    document.getElementById("product-name").value = product.name;
    document.getElementById("product-price").value = product.price;
    document.getElementById("product-stock").value = product.stock;
    document.getElementById("product-image").value = product.image;

    isCategoryInputMode = false; 
    document.getElementById("cat-select-wrapper").classList.remove("hidden");
    document.getElementById("cat-input-wrapper").classList.add("hidden");
    document.getElementById("toggle-cat-btn").innerText = "+ Tambah Baru";
    
    const select = document.getElementById("product-category-select");
    select.value = product.category;
    checkCategorySelection();
}

window.deleteProduct = async function(id) {
    if (confirm("Yakin ingin menghapus produk ini?")) {
        await deleteDoc(doc(db, "products", id));
    }
}

window.resetForm = function() {
    document.getElementById("product-id").value = "";
    document.getElementById("product-name").value = "";
    document.getElementById("product-price").value = "";
    document.getElementById("product-stock").value = "";
    document.getElementById("product-image").value = "";
    
    isCategoryInputMode = false;
    document.getElementById("cat-select-wrapper").classList.remove("hidden");
    document.getElementById("cat-input-wrapper").classList.add("hidden");
    document.getElementById("product-category-select").value = "";
    document.getElementById("product-category-input").value = "";
    
    checkCategorySelection();
}

// ==========================================
// 5. KERANJANG (CART)
// ==========================================

window.addToCart = function(id) {
    const product = allProducts.find(p => p.id === id);
    if (product.stock <= 0) {
        alert("Stok habis!");
        return;
    }

    const existingItem = cart.find(item => item.id === id);
    if (existingItem) {
        if (existingItem.qty < product.stock) {
            existingItem.qty++;
        } else {
            alert("Mencapai batas stok!");
        }
    } else {
        cart.push({ ...product, qty: 1 });
    }
    renderCart();
}

window.renderCart = function() {
    const container = document.getElementById("cart-items");
    const subtotalEl = document.getElementById("subtotal-price");
    const totalEl = document.getElementById("total-price");
    
    container.innerHTML = "";
    let total = 0;

    if (cart.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-400 mt-10">
                <i class="fas fa-shopping-basket text-4xl mb-2 opacity-30"></i>
                <p>Keranjang kosong</p>
            </div>`;
    } else {
        cart.forEach((item, index) => {
            total += item.price * item.qty;
            const div = document.createElement("div");
            div.className = "flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100 animate-fade-in mb-2";
            div.innerHTML = `
                <div>
                    <h4 class="font-bold text-sm text-lumina-dark line-clamp-1 w-32" title="${item.name}">${item.name}</h4>
                    <p class="text-xs text-gray-500">Rp ${item.price.toLocaleString()}</p>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="updateQty(${index}, -1)" class="w-6 h-6 bg-white border rounded text-xs hover:bg-gray-100">-</button>
                    <span class="text-sm font-bold w-4 text-center">${item.qty}</span>
                    <button onclick="updateQty(${index}, 1)" class="w-6 h-6 bg-white border rounded text-xs hover:bg-gray-100">+</button>
                    <button onclick="removeItem(${index})" class="text-red-500 text-xs ml-1 p-1 hover:bg-red-50 rounded"><i class="fas fa-trash"></i></button>
                </div>
            `;
            container.appendChild(div);
        });
    }

    subtotalEl.innerText = `Rp ${total.toLocaleString()}`;
    totalEl.innerText = `Rp ${total.toLocaleString()}`;
}

window.updateQty = function(index, change) {
    const item = cart[index];
    const product = allProducts.find(p => p.id === item.id);
    
    if (change === 1 && item.qty >= product.stock) {
        alert("Stok tidak mencukupi");
        return;
    }
    
    item.qty += change;
    if (item.qty <= 0) cart.splice(index, 1);
    renderCart();
}

window.removeItem = function(index) {
    cart.splice(index, 1);
    renderCart();
}

// ==========================================
// 6. CHECKOUT & STRUK & RIWAYAT
// ==========================================

window.processCheckout = async function() {
    if (cart.length === 0) {
        alert("Keranjang masih kosong!");
        return;
    }

    const confirmCheckout = confirm("Konfirmasi pembayaran dan cetak struk?");
    if (!confirmCheckout) return;

    try {
        const trxId = "TRX-" + Date.now();
        const dateNow = new Date().toLocaleString("id-ID");

        // 1. Tampilkan Data ke Struk (UI)
        document.getElementById("receipt-trx-id").innerText = trxId;
        document.getElementById("receipt-date").innerText = dateNow;
        
        const listContainer = document.getElementById("receipt-items-list");
        listContainer.innerHTML = "";
        
        let grandTotal = 0;

        // 2. Loop Items: Update Stok & Siapkan data struk
        const transactionItems = [];

        for (const item of cart) {
            // Update Stok di Firebase
            const productRef = doc(db, "products", item.id);
            // Ambil data terbaru dulu untuk menghindari stok negatif
            // (Disini kita pakai logic sederhana dulu)
            const newStock = item.stock - item.qty;
            await updateDoc(productRef, { stock: newStock });

            // Render baris di modal struk
            const row = `
                <tr>
                    <td class="py-2 text-left">${item.name}</td>
                    <td class="text-center py-2">${item.qty}</td>
                    <td class="text-right py-2">Rp ${(item.price * item.qty).toLocaleString()}</td>
                </tr>
            `;
            listContainer.innerHTML += row;
            grandTotal += (item.price * item.qty);

            transactionItems.push({
                id: item.id,
                name: item.name,
                qty: item.qty,
                price: item.price
            });
        }

        document.getElementById("receipt-total").innerText = `Rp ${grandTotal.toLocaleString()}`;

        // 3. Simpan Transaksi ke Firebase (History)
        const transactionData = {
            trxId: trxId,
            timestamp: serverTimestamp(),
            items: transactionItems,
            total: grandTotal,
            cashier: "Admin Lumina"
        };
        await addDoc(transactionsRef, transactionData);

        // 4. Tampilkan Modal Struk & Reset Keranjang
        document.getElementById("receipt-modal").classList.remove("hidden");
        cart = [];
        renderCart();

    } catch (error) {
        console.error("Checkout Error:", error);
        alert("Gagal memproses transaksi. Periksa koneksi internet.");
    }
}

window.closeReceipt = function() {
    document.getElementById("receipt-modal").classList.add("hidden");
}

// Fetch Riwayat Transaksi untuk Dashboard
window.fetchTransactions = function() {
    const q = query(transactionsRef, orderBy("timestamp", "desc"));
    
    // Perbaikan: Definisi elemen di dalam fungsi
    const list = document.getElementById("transaction-history-body"); // Pastikan ID ini ada di HTML dashboard
    const revenueEl = document.getElementById("total-revenue-day"); // Pastikan ID ini ada di HTML dashboard

    onSnapshot(q, (querySnapshot) => {     
        let totalRevenue = 0;
        
        if (list) list.innerHTML = "";

        querySnapshot.forEach((doc) => {
            const trx = doc.data();
            const time = trx.timestamp?.toDate().toLocaleTimeString("id-ID", {
                hour: '2-digit', minute: '2-digit'
            }) || "...";
            
            totalRevenue += trx.total;
            const itemNames = trx.items.map(i => `${i.name} (${i.qty})`).join(", ");

            if (list) {
                const row = `
                    <tr class="hover:bg-gray-50 transition border-b border-gray-50">
                        <td class="p-4 text-gray-500 text-xs">${time}</td>
                        <td class="p-4 font-mono text-xs font-bold text-lumina-dark">${trx.trxId}</td>
                        <td class="p-4 text-gray-600 text-[11px] truncate max-w-[150px]" title="${itemNames}">${itemNames}</td>
                        <td class="p-4 text-right font-bold text-gray-800 text-xs">Rp ${trx.total.toLocaleString()}</td>
                    </tr>
                `;
                list.innerHTML += row;
            }
        });

        if (revenueEl) revenueEl.innerText = `Rp ${totalRevenue.toLocaleString()}`;
    });
}

// ==========================================
// 7. UTILS & HELPERS
// ==========================================

// Pencarian Produk di Kasir (Kiri Atas)
window.searchProducts = function() {
    const keyword = document.getElementById("search-input").value.toLowerCase();
    const filtered = allProducts.filter(p => p.name.toLowerCase().includes(keyword));
    renderProductGrid(filtered);
}

// Filter Kategori di Kasir
window.filterGridByCategory = function(category) {
    if (category === "Semua") {
        renderProductGrid(allProducts);
    } else {
        const filtered = allProducts.filter(p => p.category === category);
        renderProductGrid(filtered);
    }
    
    // Update Style Tombol Filter
    const container = document.getElementById("category-filters");
    Array.from(container.children).forEach(btn => {
        if(btn.innerText === category) {
            btn.className = "whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold border transition bg-lumina-dark text-white border-lumina-dark";
        } else {
            btn.className = "whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold border transition bg-white text-gray-500 border-gray-200 hover:border-lumina-dark hover:text-lumina-dark";
        }
    });
}

window.openProductModal = function() {
    document.getElementById("product-modal").classList.remove("hidden");
    resetForm();
}
window.closeProductModal = function() {
    document.getElementById("product-modal").classList.add("hidden");
}

// ==========================================
// 8. EVENT LISTENERS TAMBAHAN
// ==========================================

// [FIX] Pencarian di Manajemen Inventaris (Realtime Search)
const inventorySearchInput = document.getElementById('search-inventory');
if (inventorySearchInput) {
    inventorySearchInput.addEventListener('input', (e) => {
        const keyword = e.target.value.toLowerCase();
        // Filter local state 'allProducts'
        const filtered = allProducts.filter(p => p.name.toLowerCase().includes(keyword));
        renderInventoryTable(filtered);
    });
}

// Jalankan fetch pertama kali
fetchTransactions();