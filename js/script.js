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

// Taruh di sekitar baris 35-50 (Area Fungsi Barcode)
window.renderBarcode = function() {
    const productName = document.getElementById("product-name").value;
    const barcodeSvg = document.getElementById("barcode-preview");
    
    if (productName && productName.trim() !== "") {
        try {
            JsBarcode("#barcode-preview", productName, {
                format: "CODE128",
                width: 1.5,
                height: 40,
                displayValue: true,
                fontSize: 10,
                margin: 10
            });
        } catch (error) {
            console.error("Gagal membuat barcode:", error);
        }
    } else {
        if (barcodeSvg) barcodeSvg.innerHTML = "";
    }
}

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

// Render Grid Produk (Halaman Kasir) - VERSI FIX 100%
function renderProductGrid(input = allProducts) {
    const grid = document.getElementById("product-list");
    if (!grid) return;
    
    grid.innerHTML = "";

    let productsToDisplay;

    // LOGIKA FILTER:
    if (Array.isArray(input)) {
        // Jika yang masuk adalah ARRAY (Hasil filter kategori), gunakan langsung
        productsToDisplay = input;
    } else if (typeof input === "string" && input.trim() !== "") {
        // Jika yang masuk adalah STRING (Hasil ketik di search), filter dari allProducts
        productsToDisplay = allProducts.filter(p => 
            p.name.toLowerCase().includes(input.toLowerCase())
        );
    } else {
        // Jika kosong atau lainnya, tampilkan semua
        productsToDisplay = allProducts;
    }

    if (productsToDisplay.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-10 text-gray-400">Produk tidak ditemukan</div>`;
        return;
    }

   productsToDisplay.forEach((product, index) => {
    const card = document.createElement("div");
    
    // 1. Tambahkan class 'reveal-card' dan 'product-card-kasir'
    card.className = "bg-white rounded-xl shadow-sm p-4 flex flex-col h-full border border-gray-100 cursor-pointer group reveal-card product-card-kasir";

    // 2. Tambahkan delay agar muncul satu per satu (Stagger Effect)
    // index * 0.05s artinya produk ke-2 muncul 0.05 detik setelah produk ke-1, dst.
    card.style.animationDelay = `${index * 0.05}s`;

    card.innerHTML = `
        <div class="h-48 w-full bg-gray-50 rounded-lg mb-4 overflow-hidden relative p-4 flex items-center justify-center group-hover:bg-gray-100 transition">
            <img src="${product.image}" alt="${product.name}" class="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition duration-300">
            <span class="absolute top-2 right-2 bg-white/90 backdrop-blur text-[10px] px-2 py-1 rounded-full text-gray-600 font-bold border shadow-sm">
                ${product.stock} Unit
            </span>
        </div>
        <h3 class="font-bold text-gray-800 text-sm mb-1 line-clamp-2 h-10">${product.name}</h3>
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

// Fungsi Sinkronisasi Data Manual
window.syncData = () => {
    showToast("Menyinkronkan data...");
    // Di sini biasanya Firebase onSnapshot sudah otomatis, 
    // tapi kita bisa panggil ulang render untuk memastikan visual update
    renderProductGrid(allProducts);
};

// Fungsi Sortir Produk
// 4. Update fungsi Sortir Produk
window.sortProducts = (criteria) => {
    window.currentSort = criteria;
    // Panggil fungsi proses gabungan
    window.applyFiltersAndSort();
};
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
    const selectContainer = document.getElementById("category-select");
    if (!selectContainer) return;

    // 1. Ambil kategori unik & urutkan abjad
    const productCategories = [...new Set(allProducts.map(p => p.category))].sort();
    
    // 2. Taruh "Semua" di depan
    const uniqueCategories = ["Semua", ...productCategories];
    const activeCat = window.currentCategory || 'Semua';

    // 3. Render ke dalam elemen <select> sebagai <option>
    selectContainer.innerHTML = uniqueCategories.map(cat => {
        const isSelected = cat === activeCat ? 'selected' : '';
        return `<option value="${cat}" ${isSelected}>${cat}</option>`;
    }).join("");
}
window.toggleCategoryMode = function() {
    isCategoryInputMode = !isCategoryInputMode;
    const selectWrapper = document.getElementById("cat-select-wrapper");
    const inputWrapper = document.getElementById("cat-input-wrapper");
    const toggleBtn = document.getElementById("toggle-cat-btn");
    const deleteBtn = document.getElementById("btn-delete-cat"); // Sekarang ID sudah ada

    if (isCategoryInputMode) {
        if(selectWrapper) selectWrapper.classList.add("hidden");
        if(deleteBtn) deleteBtn.classList.add("hidden"); // Cek dulu apakah ada
        if(inputWrapper) inputWrapper.classList.remove("hidden");
        
        toggleBtn.innerText = "Batal";
        toggleBtn.classList.replace("text-lumina-gold", "text-red-500");
        
        const inputField = document.getElementById("product-category-input");
        if(inputField) inputField.focus();
    } else {
        if(selectWrapper) selectWrapper.classList.remove("hidden");
        if(inputWrapper) inputWrapper.classList.add("hidden");
        
        toggleBtn.innerText = "+ Tambah Baru";
        toggleBtn.classList.replace("text-red-500", "text-lumina-gold");
        
        const inputField = document.getElementById("product-category-input");
        if(inputField) inputField.value = ""; 
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
// 4. CRUD PRODUCT (VERSI PERBAIKAN)
// ==========================================

window.saveProduct = async function() {
    // 1. Ambil semua elemen input
    const idEl = document.getElementById("product-id");
    const nameEl = document.getElementById("product-name");
    const priceEl = document.getElementById("product-price");
    const stockEl = document.getElementById("product-stock");
    const imageEl = document.getElementById("product-image");
    const descEl = document.getElementById("product-desc");

    // 2. Ambil nilai (values)
    const id = idEl.value;
    const name = nameEl.value.trim();
    const price = priceEl.value;
    const stock = stockEl.value;
    const image = imageEl.value;
    const description = descEl ? descEl.value : ""; 
    
    let category = "";
    if (isCategoryInputMode) {
        const catInput = document.getElementById("product-category-input");
        category = catInput ? catInput.value.trim() : "";
        if(category) category = category.charAt(0).toUpperCase() + category.slice(1);
    } else {
        const catSelect = document.getElementById("product-category-select");
        category = catSelect ? catSelect.value : "";
    }

    // Validasi
    if (!name || price === "" || stock === "" || !category) { 
        alert("Mohon lengkapi semua data!");
        return;
    }

    const productData = {
        name,
        category, 
        price: Number(price),
        stock: Number(stock),
        image: image || "https://via.placeholder.com/150",
        description: description 
    };

    try {
        // PROSES DATABASE
        if (id) {
            await updateDoc(doc(db, "products", id), productData);
        } else {
            await addDoc(productsRef, productData);
        }
        
        // JIKA BERHASIL: Munculkan pesan sukses dulu
        alert("Produk berhasil disimpan!");
        
        // BARU BERSIHKAN FORM (Gunakan fungsi resetForm yang sudah diperbaiki)
        resetForm();

    } catch (error) {
        // Hanya muncul jika benar-benar gagal ke Firebase
        console.error("Detail Error:", error);
        alert("Gagal menyimpan produk ke database.");
    }
}

window.resetForm = function() {
    // 1. Reset Field Standar (Teks & Hidden)
    const fields = [
        "product-id", 
        "product-name", 
        "product-price", 
        "product-stock", 
        "product-image", // Ini sekarang berfungsi sebagai penampung Base64
        "product-desc", 
        "product-category-input"
    ];
    
    fields.forEach(fieldId => {
        const el = document.getElementById(fieldId);
        if (el) el.value = "";
    });

    // 2. Reset Mode Kategori
    isCategoryInputMode = false;
    const selWrapper = document.getElementById("cat-select-wrapper");
    const inpWrapper = document.getElementById("cat-input-wrapper");
    const selEl = document.getElementById("product-category-select");

    if (selWrapper) selWrapper.classList.remove("hidden");
    if (inpWrapper) inpWrapper.classList.add("hidden");
    if (selEl) selEl.value = "";

    // 3. Reset Preview Barcode
    const barcodeSvg = document.getElementById("barcode-preview");
    if (barcodeSvg) barcodeSvg.innerHTML = "";

    // 4. MODIFIKASI TERBARU: Reset Komponen Upload Gambar
    const imageFileInput = document.getElementById("product-image-file");
    const fileNameLabel = document.getElementById("file-name-label");
    const imagePreviewContainer = document.getElementById("image-preview-container");
    const tempImagePreview = document.getElementById("temp-image-preview");

    if (imageFileInput) imageFileInput.value = ""; // Bersihkan antrean file explorer
    if (fileNameLabel) fileNameLabel.innerText = "Pilih Gambar..."; // Kembalikan teks label
    if (imagePreviewContainer) imagePreviewContainer.classList.add("hidden"); // Sembunyikan kotak preview
    if (tempImagePreview) tempImagePreview.src = ""; // Hapus gambar dari memori browser

    // 5. Jalankan pengecekan UI kategori
    if (typeof checkCategorySelection === "function") {
        checkCategorySelection();
    }
}

window.editProduct = function(id) {
    const product = allProducts.find(p => p.id === id);
    if (!product) return;

    // Masukkan data ke input form
    document.getElementById("product-id").value = product.id;
    document.getElementById("product-name").value = product.name;
    document.getElementById("product-price").value = product.price;
    document.getElementById("product-stock").value = product.stock;
    document.getElementById("product-image").value = product.image || "";
    
    // PERBAIKAN: Mengambil deskripsi dari objek product, bukan variabel gaib
    document.getElementById("product-desc").value = product.description || ""; 
    
    // Reset mode kategori ke select
    isCategoryInputMode = false; 
    document.getElementById("cat-select-wrapper").classList.remove("hidden");
    document.getElementById("cat-input-wrapper").classList.add("hidden");
    document.getElementById("toggle-cat-btn").innerText = "+ Tambah Baru";
    document.getElementById("toggle-cat-btn").classList.replace("text-red-500", "text-lumina-gold");
    
    const select = document.getElementById("product-category-select");
    if (select) {
        select.value = product.category;
    }
    checkCategorySelection();
    setTimeout(window.renderBarcode, 100);
}

// BAGIAN PERBAIKAN FUNGSI HAPUS
window.deleteProduct = async function(id) {
    if (!id) return;

    if (confirm("Apakah Anda yakin ingin menghapus produk ini?")) {
        try {
            // Kita gunakan doc dan deleteDoc yang sudah di-import di atas, 
            // JANGAN gunakan window.FirebaseFirestore lagi.
            const productRef = doc(db, "products", id);
            await deleteDoc(productRef);
            
            // Opsional: Beri notifikasi sukses
            alert("Produk berhasil dihapus!");
            console.log("ID dihapus:", id);
        } catch (error) {
            console.error("Gagal menghapus:", error);
            alert("Gagal menghapus: " + error.message);
        }
    }
}

// Referensi Koleksi Baru
const categoriesRef = collection(db, "categories");
let allCategories = [];

// 1. Ambil Data Kategori Secara Realtime
onSnapshot(categoriesRef, (snapshot) => {
    allCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderCategoryTable();
    // Update juga dropdown kategori di form produk agar otomatis sinkron
    updateProductCategoryDropdown(); 
});

// Render Tabel Kategori di Manajemen
window.renderCategoryTable = function() {
    const tbody = document.getElementById("category-table-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    allCategories.forEach(cat => {
        tbody.innerHTML += `
            <tr class="border-b hover:bg-gray-50 transition">
                <td class="p-4 w-32">
                    <img src="${cat.image || 'https://via.placeholder.com/150'}" class="w-24 h-16 rounded-lg object-cover border shadow-sm">
                </td>
                <td class="p-4 font-bold text-gray-800 w-48">${cat.name}</td>
                <td class="p-4 text-sm text-gray-500 line-clamp-2 h-20 pt-6">${cat.description || '-'}</td>
                <td class="p-4 text-center w-24">
                    <button onclick="deleteCategory('${cat.id}')" class="text-red-500 hover:text-red-700 mx-2 bg-red-50 w-8 h-8 rounded-full transition">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
};
// 1. Fungsi BARU untuk menangani proses upload gambar Kategori
window.handleCatImageUpload = function(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const reader = new FileReader();
        
        // Ubah teks pada tombol menjadi nama file yang diupload
        document.getElementById('cat-file-name-label').innerText = file.name;

        // Proses membaca file gambar
        reader.onload = function(e) {
            const base64Image = e.target.result;
            
            // Simpan hasil gambar ke input tersembunyi
            document.getElementById('cat-image-base64').value = base64Image;
            
            // Tampilkan gambar di kotak Preview
            const previewImg = document.getElementById('cat-preview-img');
            const previewText = document.getElementById('cat-preview-text');
            
            previewImg.src = base64Image;
            previewImg.classList.remove('hidden');
            previewText.classList.add('hidden');
        };
        
        reader.readAsDataURL(file); // Konversi gambar ke format Base64
    }
};

// 2. UPDATE fungsi Simpan Kategori (Ambil data dari base64, bukan URL lagi)
window.saveCategory = async function() {
    const name = document.getElementById("cat-name").value.trim();
    const desc = document.getElementById("cat-desc").value.trim();
    const imageBase64 = document.getElementById("cat-image-base64").value;

    if (!name || !imageBase64) return alert("Harap isi Judul Kategori dan Upload Gambar!");

    try {
        await addDoc(categoriesRef, {
            name: name,
            description: desc,
            image: imageBase64,
            createdAt: serverTimestamp()
        });
        alert("Kategori berhasil ditambahkan!");
        closeCategoryModal();
    } catch (error) {
        console.error("Error adding category: ", error);
    }
};

// 4. Hapus Kategori
window.deleteCategory = async function(id) {
    if (confirm("Hapus kategori ini? Produk dengan kategori ini tidak akan terhapus, tapi kategori ini tidak akan muncul di filter.")) {
        await deleteDoc(doc(db, "categories", id));
    }
};

// Fungsi UI Modal
window.openCategoryModal = () => document.getElementById("category-modal").classList.remove("hidden");
// 3. UPDATE fungsi Tutup Modal (Pastikan tombol upload dan preview di-reset)
window.closeCategoryModal = () => {
    document.getElementById("category-modal").classList.add("hidden");
    document.getElementById("cat-name").value = "";
    document.getElementById("cat-desc").value = "";
    
    // Reset tombol Upload
    document.getElementById("cat-image-file").value = "";
    document.getElementById("cat-image-base64").value = "";
    document.getElementById("cat-file-name-label").innerText = "Pilih Gambar dari Perangkat...";
    
    // Reset Preview
    document.getElementById("cat-preview-img").src = "";
    document.getElementById("cat-preview-img").classList.add("hidden");
    document.getElementById("cat-preview-text").classList.remove("hidden");
};
// Fungsi Switch Tab
window.switchManageTab = (tab) => {
    const tabProd = document.getElementById("tab-produk"); // ID tabel produk kamu
    const tabCat = document.getElementById("tab-kategori");
    
    if (tab === 'produk') {
        tabProd?.classList.remove("hidden");
        tabCat?.classList.add("hidden");
    } else {
        tabProd?.classList.add("hidden");
        tabCat?.classList.remove("hidden");
    }
};

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

// Fungsi untuk menggeser kategori secara horizontal
window.scrollCategories = function(amount) {
    const container = document.getElementById('category-filters');
    container.scrollBy({
        left: amount,
        behavior: 'smooth'
    });
};

window.searchProducts = function() {
    const searchInput = document.getElementById("search-input");
    const searchTerm = searchInput.value.trim().toLowerCase();
    
    if (searchTerm === "") {
        renderProductGrid(); // Tampilkan semua jika kosong
        return;
    }

    // 1. Cari produk yang namanya sama persis (Hasil Scan Barcode)
    const matchedProduct = allProducts.find(p => p.name.toLowerCase() === searchTerm);

    if (matchedProduct) {
        addToCart(matchedProduct.id);
        
        // RESET INPUT
        searchInput.value = "";
        
        // TAMPILKAN SEMUA PRODUK LAGI
        renderProductGrid(); 
        
        return; 
    }

    // 2. Jika sedang mengetik (bukan scan barcode), filter grid
    renderProductGrid(searchTerm); 
};

// 1. Tambahkan variabel state global di bagian atas jika belum ada
window.currentSort = "default";
// 2. Fungsi Utama untuk memproses Filter & Sortir secara bersamaan
window.applyFiltersAndSort = function() {
    let displayProducts = [...allProducts];

    // Tahap 1: Filter berdasarkan Kategori
    if (window.currentCategory && window.currentCategory !== "Semua") {
        displayProducts = displayProducts.filter(p => p.category === window.currentCategory);
    }

    // Tahap 2: Sortir berdasarkan Kriteria yang dipilih
    if (window.currentSort === 'low') {
        displayProducts.sort((a, b) => a.price - b.price);
    } else if (window.currentSort === 'high') {
        displayProducts.sort((a, b) => b.price - a.price);
    } else if (window.currentSort === 'name') {
        displayProducts.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Tahap 3: Render hasil akhir ke layar
    renderProductGrid(displayProducts);
};
// 3. Update fungsi Filter Kategori
window.filterGridByCategory = function(category) {
    window.currentCategory = category;
    // Panggil fungsi proses gabungan
    window.applyFiltersAndSort();
    
    // Sinkronisasi visual (jika perlu)
    const selectContainer = document.getElementById("category-select");
    if (selectContainer) selectContainer.value = category;
};
window.openProductModal = function() {
    document.getElementById("product-modal").classList.remove("hidden");
    resetForm();
}
window.closeProductModal = function() {
    document.getElementById("product-modal").classList.add("hidden");
}

// Membuka Modal Katalog dan Merender Semua Barcode
window.openBarcodeCatalog = function() {
    const modal = document.getElementById("barcode-catalog-modal");
    const container = document.getElementById("catalog-content");
    
    if (!modal || !container) return;
    
    container.innerHTML = ""; // Bersihkan isi lama
    modal.classList.remove("hidden");

    allProducts.forEach(product => {
        const itemDiv = document.createElement("div");
        itemDiv.className = "border border-dashed border-gray-300 p-4 flex flex-col items-center justify-center rounded-lg";
        
        itemDiv.innerHTML = `
            <p class="text-[10px] font-bold text-gray-700 mb-1 uppercase text-center truncate w-full">${product.name}</p>
            <svg id="catalog-barcode-${product.id}"></svg>
            <p class="text-[9px] text-gray-500 mt-1">Rp ${parseInt(product.price).toLocaleString()}</p>
        `;
        
        container.appendChild(itemDiv);

        // Render Barcode menggunakan JsBarcode
        JsBarcode(`#catalog-barcode-${product.id}`, product.name, {
            format: "CODE128",
            width: 1.2,
            height: 40,
            displayValue: false, // Kita sudah buat teks manual di atas agar lebih rapi
            margin: 5
        });
    });
}

window.closeBarcodeCatalog = function() {
    document.getElementById("barcode-catalog-modal").classList.add("hidden");
}

window.printCatalog = function() {
    window.print();
}

window.handleImageUpload = function(input) {
    const file = input.files[0];
    const label = document.getElementById("file-name-label");
    const previewContainer = document.getElementById("image-preview-container");
    const previewImg = document.getElementById("temp-image-preview");
    const hiddenInput = document.getElementById("product-image");

    if (file) {
        // Tampilkan nama file di label
        label.innerText = file.name;

        // Gunakan FileReader untuk membaca gambar
        const reader = new FileReader();
        reader.onload = function(e) {
            // Masukkan data gambar ke preview
            previewImg.src = e.target.result;
            previewContainer.classList.remove("hidden");
            previewContainer.classList.add("flex");

            // Simpan data base64 ke input hidden agar bisa disimpan ke database
            hiddenInput.value = e.target.result;
        };
        reader.readAsDataURL(file);
    }
};

// Memastikan kursor selalu fokus ke kolom scan saat halaman siap
document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("search-input");
    if (searchInput) searchInput.focus();
});

// Fokus kembali ke input setelah modal ditutup atau transaksi selesai
window.addEventListener("click", (e) => {
    if (e.target.id === "category-select") {
        return; // Hentikan perintah pemaksaan fokus di sini
    }

    if (e.target.id === "category-select" || e.target.id === "sort-select") {
        return; // Jangan lakukan apa-apa jika yang diklik adalah salah satu dropdown
    }

    // Jika tidak sedang mengisi form modal, kembalikan fokus ke input utama
    const modalProduk = document.getElementById("product-modal");
    if (modalProduk && modalProduk.classList.contains("hidden")) {
        document.getElementById("search-input").focus();
    }
});

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

const nameInput = document.getElementById("product-name");
if (nameInput) {
    nameInput.addEventListener("input", window.renderBarcode);
}

// Jalankan fetch pertama kali
fetchTransactions();
