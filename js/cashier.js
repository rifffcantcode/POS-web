import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc,
    doc, 
    runTransaction,
    onSnapshot, 
    query, 
    orderBy, 
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { showPopup, showConfirmModal } from "./notify.js";
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
const auth = getAuth(app);

window.db = db;
window.auth = auth;

// Variabel Referensi Koleksi
const productsRef = collection(db, "products");
const salesRef = collection(db, "sales"); 

// STATE VARIABLES
let allProducts = [];
let deletedProducts = []; 
window.deletedCategories = [];
let isShowingTrash = false;
let cart = [];
let isCategoryInputMode = false; 

// ==========================================
// FUNGSI PENCARIAN PRODUK
// ==========================================
window.handleSearch = (e) => {
    // Ambil teks yang diketik (ubah ke huruf kecil agar pencarian tidak sensitif huruf besar)
    const query = e.target.value.toLowerCase();
    
    // Filter dari array allProducts yang sudah ada di memori
   const filtered = allProducts.filter(p => {
    const nameMatch = p.name.toLowerCase().includes(query);
    const categoryMatch = p.category.toLowerCase().includes(query);
    return nameMatch || categoryMatch;
});
    
    // Tampilkan hasil filter ke grid produk
    renderProductGrid(filtered);
};

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
  const allDocs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  // Pisahkan yang aktif dan yang terhapus
  allProducts = allDocs.filter((product) => product.isDeleted !== true);
  window.allProducts = allProducts; 
  window.deletedProducts = allDocs.filter((product) => product.isDeleted === true);
  renderProductGrid(allProducts);
  renderInventoryTable(allProducts); 
  renderCategoryFilters();
  loadCategoriesIntoSelect();
  
  // Render ke tabel tempat sampah
  renderTrashProducts(window.deletedProducts);
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
        <div class="mt-auto flex items-end justify-between gap-3">
            <div>
                <p class="text-[10px] text-gray-400 font-bold uppercase">Harga</p>
                <span class="font-black text-lumina-dark text-lg">Rp ${parseInt(product.price).toLocaleString("id-ID")}</span>
            </div>
            <div class="flex gap-2">
                <button onclick="addToCart('${product.id}')" 
                    class="add-to-cart-mobile bg-lumina-dark text-white px-4 py-2 rounded-xl flex items-center justify-center hover:bg-lumina-gold hover:text-lumina-dark transition shadow-md active:scale-95" style="display:none">
                    <i class="fas fa-plus"></i> Tambah ke Keranjang
                </button>
                <button onclick="addToCart('${product.id}')" 
                    class="add-to-cart-desktop hidden md:flex bg-lumina-dark text-white w-10 h-10 rounded-xl items-center justify-center hover:bg-lumina-gold hover:text-lumina-dark transition shadow-md active:scale-95">
                    <i class="fas fa-plus"></i>
                </button>
            </div>
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
        row.className = "border-b hover:bg-gray-50/80 transition-all duration-200";
       // Di dalam fungsi renderInventoryTable(products)
row.innerHTML = `
    <td class="p-3 font-medium text-gray-800 text-sm">${product.name}</td>
    <td class="p-3 text-gray-500"><span class="bg-gray-100 px-2 py-1 rounded text-xs border">${product.category}</span></td>
    <td class="p-3 text-sm">Rp ${parseInt(product.price).toLocaleString()}</td>
    <td class="p-3 text-center font-bold text-sm ${product.stock < 5 ? 'text-red-500' : 'text-green-600'}">${product.stock}</td>
    <td class="p-3 text-center">
        <div class="flex items-center justify-center gap-1">
            <button onclick="window.viewBarcode('${product.id}')" class="bg-indigo-50 text-indigo-600 p-2 rounded hover:bg-indigo-600 hover:text-white transition shadow-sm">
                <i class="fas fa-barcode"></i>
            </button>
            
            <button onclick="editProduct('${product.id}')" class="bg-yellow-50 text-yellow-600 p-2 rounded hover:bg-yellow-100 transition">
                <i class="fas fa-edit"></i>
            </button>
            
            <button onclick="deleteProduct('${product.id}')" class="bg-red-50 text-red-600 p-2 rounded hover:bg-red-100 transition">
                <i class="fas fa-trash"></i>
            </button>
        </div>
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

window.softDeleteCategory = async (id) => {
    if (!confirm("Pindahkan kategori ke tempat sampah?")) return;

    try {
        const catRef = doc(db, "categories", id);

        await updateDoc(catRef, {
            isDeleted: true
        });

        showPopup("Kategori dipindahkan ke tempat sampah!");
    } catch (error) {
        console.error("Error:", error);
        showPopup("Gagal menghapus kategori.");
    }
};

window.restoreCategory = async (id) => {
    if (!confirm("Kembalikan kategori ini?")) return;

    try {
        const catRef = doc(db, "categories", id);

        await updateDoc(catRef, {
            isDeleted: false
        });

        showPopup("Kategori berhasil dikembalikan!");
    } catch (error) {
        console.error(error);
        showPopup("Gagal restore kategori.");
    }
};

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
        showPopup("Mohon lengkapi semua data!");
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
        showPopup("Produk berhasil disimpan!");
        
        // BARU BERSIHKAN FORM (Gunakan fungsi resetForm yang sudah diperbaiki)
        resetForm();

    } catch (error) {
        // Hanya muncul jika benar-benar gagal ke Firebase
        console.error("Detail Error:", error);
        showPopup("Gagal menyimpan produk ke database.");
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

window.deleteProduct = async (id) => {
  if (confirm("Apakah Anda yakin ingin menghapus produk ini?")) {
    try {
      // Menerapkan Soft Delete: mengubah status isDeleted menjadi true
      const productRef = doc(db, "products", id);
      await updateDoc(productRef, {
        isDeleted: true,
        updatedAt: serverTimestamp()
      });
      showToast("Produk berhasil dihapus", "success");
    } catch (e) {
      console.error("Error menghapus produk: ", e);
      showToast("Gagal menghapus produk", "error");
    }
  }
};

// Referensi Koleksi Baru
const categoriesRef = collection(db, "categories");
let allCategories = [];
let editingCategoryId = null;

// 1. Ambil Data Kategori Secara Realtime
onSnapshot(categoriesRef, (snapshot) => {
    // FILTER SOFT DELETE: Hanya simpan ke array jika isDeleted BUKAN true
    allCategories = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(cat => cat.isDeleted !== true);

    renderCategoryTable();
    // Update juga dropdown kategori di form produk agar otomatis sinkron
    if (typeof updateProductCategoryDropdown === "function") {
        updateProductCategoryDropdown();
    }
});

// Render Tabel Kategori di Manajemen
window.renderCategoryTable = function() {
    const tbody = document.getElementById("category-table-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    allCategories.forEach(cat => {
        const row = document.createElement("tr");
        row.className = "border-b hover:bg-gray-50 transition";

        row.innerHTML = `
            <td class="p-4 w-32">
                <img src="${cat.image || 'https://via.placeholder.com/150'}" 
                     class="w-24 h-16 rounded-lg object-cover border shadow-sm">
            </td>

            <td class="p-4 font-bold text-gray-800 w-48">
                ${cat.name}
            </td>

            <td class="p-4 text-sm text-gray-500 line-clamp-2 h-20 pt-6">
                ${cat.description || '-'}
            </td>

            <td class="p-4 text-center">
                <div class="flex justify-center items-center gap-2">

                    <!-- EDIT (SAMA KAYAK PRODUCT) -->
                    <button onclick="editCategory('${cat.id}')" 
                        class="bg-yellow-50 text-yellow-600 p-2 rounded hover:bg-yellow-100 transition">
                        <i class="fas fa-edit"></i>
                    </button>

                    <!-- DELETE -->
                    <button onclick="softDeleteCategory('${cat.id}')" 
                        class="bg-red-50 text-red-600 p-2 rounded hover:bg-red-100 transition">
                        <i class="fas fa-trash"></i>
                    </button>

                </div>
            </td>
        `;

        tbody.appendChild(row);
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

// 2. UPDATE fungsi Simpan Kategori
window.saveCategory = async () => {
    const titleEl = document.getElementById("category-title");
    const descEl = document.getElementById("category-desc");
    const imageBase64 = document.getElementById("cat-image-base64").value;

    const titleVal = titleEl.value.trim();
    const descVal = descEl.value.trim();

    if (!titleVal || !imageBase64) {
        showPopup("Judul & gambar wajib diisi!");
        return;
    }

    try {
        if (editingCategoryId) {
            //  EDIT MODE
            await updateDoc(doc(db, "categories", editingCategoryId), {
                name: titleVal,
                description: descVal,
                image: imageBase64,
                updatedAt: serverTimestamp()
            });

            showPopup("Kategori berhasil diupdate!");
            editingCategoryId = null;

        } else {
            // ➕ CREATE MODE
            await addDoc(collection(db, "categories"), {
                name: titleVal,
                description: descVal,
                image: imageBase64,
                isDeleted: false,
                createdAt: serverTimestamp()
            });

            showPopup("Kategori berhasil dibuat!");
        }

        closeCategoryModal();

    } catch (error) {
        console.error(error);
        showPopup("Gagal menyimpan kategori.");
    }
};

window.closeAddCategoryModal = () => {
    const modal = document.getElementById("add-category-modal");
    if (modal) {
        modal.classList.add("hidden"); // Menghilangkan modal
    }
};

// Fungsi UI Modal
window.openCategoryModal = () => document.getElementById("category-modal").classList.remove("hidden");
// 3. UPDATE fungsi Tutup Modal (Pastikan tombol upload dan preview di-reset)
window.closeCategoryModal = () => {
    document.getElementById("category-modal").classList.add("hidden");

    document.getElementById("category-title").value = "";
    document.getElementById("category-desc").value = "";

    // reset edit mode
    editingCategoryId = null;

    // reset upload
    document.getElementById("cat-image-file").value = "";
    document.getElementById("cat-image-base64").value = "";
    document.getElementById("cat-file-name-label").innerText = "Pilih Gambar dari Perangkat...";

    // reset preview
    document.getElementById("cat-preview-img").src = "";
    document.getElementById("cat-preview-img").classList.add("hidden");
    document.getElementById("cat-preview-text").classList.remove("hidden");
};
// FUNGSI PERPINDAHAN TAB MODAL
window.switchManageTab = (tab) => {
    const tabIds = ['produk', 'kategori', 'trash'];
    
    tabIds.forEach(t => {
        const contentEl = document.getElementById(`tab-${t}`);
        const btnEl = document.getElementById(`btn-tab-${t}`);
        
        if (contentEl && btnEl) {
            if (t === tab) {
                // Tampilkan tab aktif
                contentEl.classList.remove('hidden');
                btnEl.classList.add('text-lumina-dark', 'border-lumina-dark');
                btnEl.classList.remove('text-gray-400', 'border-transparent');
            } else {
                // Sembunyikan tab lain
                contentEl.classList.add('hidden');
                btnEl.classList.remove('text-lumina-dark', 'border-lumina-dark');
                btnEl.classList.add('text-gray-400', 'border-transparent');
            }
        }
    });

    // Otomatis render ulang tabel sampah setiap kali tabnya dibuka
    if (tab === 'trash') {
        if (typeof window.renderTrashProducts === 'function') window.renderTrashProducts();
        if (typeof window.renderTrashCategories === 'function') window.renderTrashCategories();
    }
};

// Fungsi Render untuk Tabel Tempat Sampah
function renderTrashTables() {
    // Ambil data dari state 'allProducts' yang isDeleted === true
    const deletedProducts = window.deletedProducts;
    const productTrashBody = document.getElementById('trash-products-body');
    
    productTrashBody.innerHTML = deletedProducts.length ? '' : '<tr><td colspan="2" class="p-4 text-center text-gray-400 italic">Tidak ada produk di sampah</td></tr>';
    
    deletedProducts.forEach(product => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="p-4 font-medium text-gray-700">${product.name}</td>
           <td class="p-4 text-center space-x-2">
  <button onclick="restoreProduct('${product.id}')" 
    class="text-blue-600 hover:bg-blue-50 px-3 py-1 rounded-lg text-xs font-bold border border-blue-200">
    <i class="fas fa-undo"></i>
  </button>

  <button onclick="hardDeleteProduct('${product.id}')" 
    class="text-red-600 hover:bg-red-50 px-3 py-1 rounded-lg text-xs font-bold border border-red-200">
    <i class="fas fa-trash"></i>
  </button>
</td>
        `;
        productTrashBody.appendChild(tr);
    });

    // Lakukan hal yang sama untuk kategori jika kamu punya status 'isDeleted' di kategori
}

window.editCategory = function(id) {
    const category = allCategories.find(c => c.id === id);
    if (!category) return;

    editingCategoryId = id;

    // Isi form
    document.getElementById("category-title").value = category.name;
    document.getElementById("category-desc").value = category.description || "";
    document.getElementById("cat-image-base64").value = category.image || "";

    // Preview image
    const previewImg = document.getElementById("cat-preview-img");
    const previewText = document.getElementById("cat-preview-text");

    if (category.image) {
        previewImg.src = category.image;
        previewImg.classList.remove("hidden");
        previewText.classList.add("hidden");
    }

    // Buka modal
    document.getElementById("category-modal").classList.remove("hidden");
};

window.hardDeleteProduct = async (id) => {
  const confirmed = await showConfirmModal({
    title: "Hapus Produk Permanen",
    message: "Produk akan dihapus permanen dan tidak bisa dikembalikan. Lanjutkan?",
    confirmText: "Ya, Hapus",
    cancelText: "Batal",
  });
  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, "products", id));
    showPopup("Produk berhasil dihapus permanen!");
  } catch (error) {
    console.error(error);
    showPopup("Gagal menghapus produk.");
  }
};

window.hardDeleteCategory = async (id) => {
  const confirmed = await showConfirmModal({
    title: "Hapus Kategori Permanen",
    message: "Kategori akan dihapus permanen dari database. Lanjutkan?",
    confirmText: "Ya, Hapus",
    cancelText: "Batal",
  });
  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, "categories", id));
    showPopup("Kategori berhasil dihapus permanen!");
  } catch (error) {
    console.error(error);
    showPopup("Gagal menghapus kategori.");
  }
};


// ==========================================
// 5. KERANJANG (CART)
// ==========================================

window.addToCart = function(id) {
    const product = allProducts.find(p => p.id === id);
    if (product.stock <= 0) {
        showPopup("Stok habis!");
        return;
    }

    const existingItem = cart.find(item => item.id === id);
    if (existingItem) {
        if (existingItem.qty < product.stock) {
            existingItem.qty++;
        } else {
            showPopup("Mencapai batas stok!");
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
        showPopup("Stok tidak mencukupi");
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
// PROSES CHECKOUT & CETAK STRUK
// ==========================================
async function reduceProductStockAfterSuccess(purchasedItems) {
    if (!Array.isArray(purchasedItems) || purchasedItems.length === 0) return;

    await runTransaction(db, async (transaction) => {
        const refs = purchasedItems.map((item) => ({
            ref: doc(db, "products", item.id),
            qty: Number(item.qty || 0),
            name: item.name || item.id,
        }));

        const currentStocks = [];

        for (const item of refs) {
            const snap = await transaction.get(item.ref);
            if (!snap.exists()) {
                throw new Error(`Produk tidak ditemukan: ${item.name}`);
            }

            const data = snap.data();
            const currentStock = Number(data.stock || 0);

            if (currentStock < item.qty) {
                throw new Error(`Stok tidak cukup untuk ${item.name}. Sisa: ${currentStock}`);
            }

            currentStocks.push({ item, currentStock });
        }

        for (const entry of currentStocks) {
            transaction.update(entry.item.ref, {
                stock: entry.currentStock - entry.item.qty,
                updatedAt: serverTimestamp(),
            });
        }
    });
}

window.processCheckout = async function () {
    if (cart.length === 0) return showPopup("Keranjang kosong!");

    try {
        const orderId = "INV-" + Date.now();

        const response = await fetch("https://lumina-kz2q.onrender.com/create-transaction", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                cart: cart.map(item => ({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    quantity: item.qty
                })),
                orderId,
                userId: auth.currentUser?.uid || "guest"
            }),
        });

        const data = await response.json();

        if (!data.token) {
            showPopup("Gagal membuat transaksi");
            return;
        }

        // SNAP MIDTRANS
        window.snap.pay(data.token, {
    onSuccess: async function(result) {
        console.log("Pembayaran sukses:", result);
        if (window.snap && typeof window.snap.hide === "function") {
            try { window.snap.hide(); } catch (e) { console.warn("snap.hide gagal:", e); }
        }

        // tampilkan struk dulu agar tidak ketahan error network/backend
        const cartSnapshot = cart.map(item => ({ ...item }));
        if (typeof window.showReceipt === "function") {
            window.showReceipt(cartSnapshot, orderId);
        } else {
            showReceipt(cartSnapshot, orderId);
        }

        // update status ke backend (non-blocking UI)
        try {
            await fetch("https://lumina-kz2q.onrender.com/update-status-by-token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    token: data.token,
                    status: "success",
                }),
            });
        } catch (updateErr) {
            console.error("Gagal update status token:", updateErr);
        }

        // ✅ kurangi stok produk di Firestore
        try {
            await reduceProductStockAfterSuccess(cartSnapshot);
        } catch (stockErr) {
            console.error("Gagal update stok produk:", stockErr);
            showPopup(`Pembayaran sukses, tapi update stok gagal: ${stockErr.message}`);
        }

        // ✅ reset keranjang
        cart = [];
        renderCart();
    },

    onPending: function(result) {
        console.log("Pending:", result);
        showPopup("Pembayaran pending");
    },

    onError: function(result) {
        console.log("Error:", result);
        showPopup("Pembayaran gagal");
    }
});

        function resetCart() {
            cart = [];
            renderCart();
        }

    } catch (error) {
        console.error(error);
        showPopup("Terjadi kesalahan");
    }
};
function showReceipt(cart, orderId) {
    let total = 0;
    let rows = "";

    cart.forEach(item => {
        const subtotal = item.price * item.qty;
        total += subtotal;

        rows += `
            <div class="flex justify-between">
                <span>${item.name} x${item.qty}</span>
                <span>${subtotal}</span>
            </div>
        `;
    });

    const html = `
        <div>
            <h3 class="text-center font-bold">LUMINA STORE</h3>
            <p class="text-center">-------------------</p>

            <p>ID: ${orderId}</p>
            <p>${new Date().toLocaleString("id-ID")}</p>

            <hr class="my-2">

            ${rows}

            <hr class="my-2">

            <div class="flex justify-between font-bold">
                <span>Total</span>
                <span>Rp ${total.toLocaleString()}</span>
            </div>

            <hr class="my-2">

            <p class="text-center">Terima kasih 🙏</p>
        </div>
    `;

    const receiptContent = document.getElementById("receipt-content");
    if (!receiptContent) {
        console.error("Element #receipt-content tidak ditemukan.");
        return;
    }
    receiptContent.innerHTML = html;

    const modal = document.getElementById("receipt-modal");
    if (!modal) {
        console.error("Element #receipt-modal tidak ditemukan.");
        return;
    }
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    modal.style.display = "";
    modal.style.zIndex = "";
}
window.showReceipt = showReceipt;
window.closeReceiptModal = function() {
    const modal = document.getElementById("receipt-modal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    modal.style.display = "";
}
window.closeReceipt = window.closeReceiptModal;
// Fungsi ini sekarang lebih simpel karena data sudah diisi di processCheckout
window.printReceipt = function () {
    window.print();
};
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
        renderProductGrid();
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

// ============================================================
// FITUR TEMPAT SAMPAH (PRODUK & KATEGORI)
// ============================================================

window.renderTrashProducts = () => {
    const tbody = document.getElementById("trash-products-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!window.deletedProducts || window.deletedProducts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" class="p-6 text-center text-gray-400 text-sm italic">Tong sampah produk kosong.</td></tr>`;
        return;
    }

    window.deletedProducts.forEach((product) => {
        tbody.innerHTML += `
            <tr class="hover:bg-red-50/50 transition border-b border-gray-50">
                <td class="p-4 text-sm font-medium text-gray-700 line-through decoration-red-400 decoration-2">${product.name}</td>
                <td class="p-4 text-center space-x-2">

                    <!-- RESTORE -->
                    <button onclick="restoreProduct('${product.id}')" 
                        class="bg-white border border-green-200 text-green-600 px-3 py-1.5 rounded-lg hover:bg-green-50 font-bold text-xs transition shadow-sm">
                        <i class="fas fa-undo"></i>
                    </button>

                    <!-- HARD DELETE -->
                    <button onclick="hardDeleteProduct('${product.id}')" 
                        class="bg-white border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 font-bold text-xs transition shadow-sm">
                        <i class="fas fa-trash"></i>
                    </button>

                </td>
            </tr>
        `;
    });
};

window.renderTrashCategories = function() {
    const tbody = document.getElementById("trash-categories-body");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (!window.deletedCategories || window.deletedCategories.length === 0) {
         tbody.innerHTML = `<tr><td colspan="2" class="p-6 text-center text-gray-400 text-sm italic">Tong sampah kategori kosong.</td></tr>`;
        return;
    }

    window.deletedCategories.forEach(cat => {
        tbody.innerHTML += `
            <tr class="hover:bg-red-50/50 transition border-b border-gray-50">
                <td class="p-4 text-sm font-medium text-gray-700 line-through decoration-red-400 decoration-2">${cat.name}</td>
                <td class="p-4 text-center space-x-2">

                    <!-- RESTORE -->
                    <button onclick="restoreCategory('${cat.id}')" 
                        class="bg-white border border-green-200 text-green-600 px-3 py-1.5 rounded-lg hover:bg-green-50 font-bold text-xs transition shadow-sm">
                        <i class="fas fa-undo"></i>
                    </button>

                    <!-- HARD DELETE -->
                    <button onclick="hardDeleteCategory('${cat.id}')" 
                        class="bg-white border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 font-bold text-xs transition shadow-sm">
                        <i class="fas fa-trash"></i>
                    </button>

                </td>
            </tr>
        `;
    });
};

window.restoreProduct = async (id) => {
    if (confirm("Kembalikan produk ini ke daftar aktif?")) {
        try {
            await updateDoc(doc(db, "products", id), { 
                isDeleted: false, 
                updatedAt: serverTimestamp() 
            });
            showPopup("Produk berhasil dipulihkan!");
            // Tabel otomatis render ulang berkat onSnapshot
        } catch (e) {
            console.error("Error restoring product:", e);
        }
    }
};

window.restoreCategory = async (id) => {
    if (confirm("Kembalikan kategori ini ke daftar aktif?")) {
        try {
            await updateDoc(doc(db, "categories", id), { 
                isDeleted: false, 
                updatedAt: serverTimestamp() 
            });
            showPopup("Kategori berhasil dipulihkan!");
        } catch (e) {
            console.error("Error restoring category:", e);
        }
    }
};

// Deklarasikan variabel global agar bisa dibaca tempat sampah
window.allCategories = [];
window.deletedCategories = [];

// 1. Ambil Data Kategori Secara Realtime (HANYA SATU DI SINI)
onSnapshot(categoriesRef, (snapshot) => {
    // Ambil semua dokumen
    const allDocs = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
    }));

    // Pisahkan: Kategori Aktif vs Kategori Tempat Sampah
    window.allCategories = allDocs.filter(cat => cat.isDeleted !== true);
    window.deletedCategories = allDocs.filter(cat => cat.isDeleted === true);

    // 1. Render tabel utama
    renderCategoryTable();

    // 2. Render tabel tempat sampah (PENTING AGAR TEMPAT SAMPAH UPDATE)
    if (typeof renderTrashCategories === "function") {
        renderTrashCategories();
    }

    // 3. Update juga dropdown kategori di form produk agar otomatis sinkron
    if (typeof updateProductCategoryDropdown === "function") {
        updateProductCategoryDropdown();
    }
});

// ============================================================
// FUNGSI UPDATE DROPDOWN KATEGORI DI FORM PRODUK
// ============================================================
window.updateProductCategoryDropdown = function() {
    const categorySelect = document.getElementById("product-category-select"); 
    
    if (!categorySelect) {
        console.warn("Elemen dropdown kategori tidak ditemukan!");
        return;
    }

    // DEBUG: Cek apakah data kategorinya berhasil masuk ke sini
    console.log("Data Kategori untuk Dropdown:", window.allCategories);

    const currentSelection = categorySelect.value;
    categorySelect.innerHTML = '<option value="" disabled selected>Pilih Kategori...</option>';

    // Gunakan window.allCategories yang sudah dijamin ada datanya
    if (window.allCategories && window.allCategories.length > 0) {
        window.allCategories.forEach(cat => {
            const option = document.createElement("option");
            option.value = cat.name; 
            option.textContent = cat.name;
            categorySelect.appendChild(option);
        });
    } else {
        console.warn("Daftar window.allCategories kosong atau belum dimuat!");
    }

    if (currentSelection) {
        const optionExists = Array.from(categorySelect.options).some(opt => opt.value === currentSelection);
        if (optionExists) {
            categorySelect.value = currentSelection;
        }
    }
};

// FUNGSI UNTUK MELIHAT BARCODE PER BARANG

window.viewBarcode = function(productId) {
    if (!window.allProducts || window.allProducts.length === 0) {
        showPopup("Data produk belum siap, coba lagi...");
        return;
    }
    const product = window.allProducts.find(p => p.id === productId);
    if (!product) {
        showPopup("Produk tidak ditemukan!");
        return;
    }
    const barcodeContent = product.barcode || product.name;
    // Siapkan konten label barcode
    const labelHTML = `
        <div class="brand-name text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-2">LUMINA INVENTORY</div>
        <h2 class="text-lg font-bold text-slate-800 text-center mb-1">${product.name}</h2>
        <div class="category text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full inline-block border border-slate-200 mb-2">${product.category}</div>
        <div class="barcode-wrapper my-4 bg-white p-2 w-full flex justify-center">
            <svg id="barcode-modal-svg"></svg>
        </div>
        <div class="price-tag text-2xl font-extrabold text-slate-800 mt-2">Rp ${parseInt(product.price).toLocaleString('id-ID')}</div>
    `;
    // Masukkan ke modal
    const modal = document.getElementById('barcode-modal');
    const content = document.getElementById('barcode-label-content');
    if (content) content.innerHTML = labelHTML;
    // Tampilkan modal
    if (modal) modal.classList.remove('hidden');
    // Render barcode
    setTimeout(() => {
        if (window.JsBarcode) {
            JsBarcode("#barcode-modal-svg", barcodeContent, {
                format: "CODE128",
                lineColor: "#1e293b",
                width: 2,
                height: 60,
                displayValue: true,
                fontSize: 12,
                fontOptions: "bold",
                margin: 0
            });
        }
    }, 100);
    // Simpan data produk untuk print
    window._barcodeModalProduct = product;
};

// Tutup modal barcode
window.closeBarcodeModal = function() {
    const modal = document.getElementById('barcode-modal');
    if (modal) modal.classList.add('hidden');
    // Bersihkan konten
    const content = document.getElementById('barcode-label-content');
    if (content) content.innerHTML = '';
    window._barcodeModalProduct = null;
};

// Print label barcode dari modal
window.printBarcodeLabel = function() {
    const product = window._barcodeModalProduct;
    if (!product) return;
    // Ambil SVG barcode
    const svg = document.getElementById('barcode-modal-svg');
    if (!svg) return;
    // Siapkan HTML print
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html><head><title>Barcode Label - ${product.name}</title>
        <style>
            body { background: #f1f5f9; font-family: 'Inter', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
            .label-container { background: white; width: 320px; padding: 24px; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; text-align: center; }
            .brand-name { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px; }
            h2 { margin: 0; font-size: 18px; color: #1e293b; font-weight: 700; line-height: 1.2; overflow: hidden; }
            .category { font-size: 11px; color: #64748b; background: #f8fafc; padding: 4px 12px; border-radius: 99px; display: inline-block; margin-top: 8px; border: 1px solid #e2e8f0; }
            .barcode-wrapper { margin: 20px 0; padding: 10px; background: white; }
            .price-tag { font-size: 24px; font-weight: 800; color: #1e293b; margin-top: 5px; }
            @media print { body { background: white; } .label-container { box-shadow: none; border: 1px solid #eee; } }
        </style></head><body>
        <div class="label-container">
            <div class="brand-name">LUMINA INVENTORY</div>
            <h2>${product.name}</h2>
            <div class="category">${product.category}</div>
            <div class="barcode-wrapper">${svg.outerHTML}</div>
            <div class="price-tag">Rp ${parseInt(product.price).toLocaleString('id-ID')}</div>
        </div>
        <script>window.onload = function() { window.print(); };</script>
        </body></html>
    `);
    printWindow.document.close();
};
// ==========================================
// 9. EVENT LISTENERS TAMBAHAN
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

window.fetchTransactions = function() {
    console.log("fetchTransactions dipanggil");
};

// Jalankan fetch pertama kali
fetchTransactions();

