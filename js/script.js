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
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
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
        <div class="mt-auto flex justify-between items-end">
            <div>
                <p class="text-[10px] text-gray-400 font-bold uppercase">Harga</p>
                <span class="font-black text-lumina-dark text-lg">Rp ${parseInt(product.price).toLocaleString("id-ID")}</span>
            </div>
<button onclick="addToCart('${product.id}')" 
class="hidden md:flex bg-lumina-dark text-white w-10 h-10 rounded-xl items-center justify-center hover:bg-lumina-gold hover:text-lumina-dark transition shadow-md active:scale-95">
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

        alert("Kategori dipindahkan ke tempat sampah!");
    } catch (error) {
        console.error("Error:", error);
        alert("Gagal menghapus kategori.");
    }
};

window.restoreCategory = async (id) => {
    if (!confirm("Kembalikan kategori ini?")) return;

    try {
        const catRef = doc(db, "categories", id);

        await updateDoc(catRef, {
            isDeleted: false
        });

        alert("Kategori berhasil dikembalikan!");
    } catch (error) {
        console.error(error);
        alert("Gagal restore kategori.");
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
        alert("Judul & gambar wajib diisi!");
        return;
    }

    try {
        if (editingCategoryId) {
            // ✏️ EDIT MODE
            await updateDoc(doc(db, "categories", editingCategoryId), {
                name: titleVal,
                description: descVal,
                image: imageBase64,
                updatedAt: serverTimestamp()
            });

            alert("Kategori berhasil diupdate!");
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

            alert("Kategori berhasil dibuat!");
        }

        closeCategoryModal();

    } catch (error) {
        console.error(error);
        alert("Gagal menyimpan kategori.");
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
  if (!confirm("Hapus PERMANEN produk ini? (tidak bisa dikembalikan)")) return;

  try {
    await deleteDoc(doc(db, "products", id));
    alert("Produk berhasil dihapus permanen!");
  } catch (error) {
    console.error(error);
    alert("Gagal menghapus produk.");
  }
};

window.hardDeleteCategory = async (id) => {
  if (!confirm("Hapus PERMANEN kategori ini?")) return;

  try {
    await deleteDoc(doc(db, "categories", id));
    alert("Kategori berhasil dihapus permanen!");
  } catch (error) {
    console.error(error);
    alert("Gagal menghapus kategori.");
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
// PROSES CHECKOUT & CETAK STRUK
// ==========================================
window.processCheckout = async function() {
    if (cart.length === 0) return alert("Keranjang kosong!");
    if (!confirm("Proses pembayaran dan lihat preview struk?")) return;

    try {
        let totalVal = 0;
        let tableRows = "";

        const currentUser = auth.currentUser;

        cart.forEach(item => {
            const subtotal = item.price * item.qty;
            totalVal += subtotal;
            tableRows += `
                <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0;">${item.name}</td>
                    <td style="text-align: center; color: #666;">${item.qty}</td>
                    <td style="text-align: right; font-weight: bold;">Rp ${subtotal.toLocaleString()}</td>
                </tr>`;
        });

        const saleData = {
            userId: currentUser ? currentUser.uid : "guest", // Menyimpan ID User
            customerName: currentUser ? (currentUser.displayName || currentUser.email) : "Guest",
            items: cart.map(item => ({
                id: item.id,
                name: item.name,
                qty: item.qty,
                price: item.price
            })),
            totalPrice: totalVal,
            timestamp: serverTimestamp() // Menggunakan waktu server
        };
        
        await addDoc(collection(db, "sales"), saleData);

        // Update Stok Firebase
        for (const item of cart) {
            const productRef = doc(db, "products", item.id);
            await updateDoc(productRef, { stock: item.stock - item.qty });
        }

        // Buka Jendela Preview dengan Desain Baru
        const printWindow = window.open('', '_blank', 'height=750,width=480');
        printWindow.document.write(`
            <html>
                <head>
                    <title>PREVIEW_LUMINA_${Date.now()}</title>
                    <style>
                        /* KUNCI: Reset default browser agar bersih */
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        
                        body { 
                            font-family: 'Inter', -apple-system, sans-serif; 
                            background-color: #0c1a32; /* Biru Gelap Background Dashboard */
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            min-height: 100vh;
                            padding: 20px;
                        }

                        .receipt-card {
                            background: white;
                            padding: 30px;
                            width: 380px;
                            box-shadow: 0 10px 25px rgba(0,0,0,0.3);
                            border-radius: 12px;
                            position: relative;
                            overflow: hidden;
                        }
                        
                        /* Aksen kuning di atas kartu struk */
                        .receipt-card::before {
                            content: '';
                            position: absolute;
                            top: 0; left: 0; width: 100%; height: 5px;
                            background-color: #facc15; /* Kuning Logo Lumina */
                        }

                        .header { text-align: center; margin-bottom: 25px; }
                        .logo { 
                            font-size: 28px; 
                            font-weight: 900; 
                            color: #facc15; /* KUNING LOGO LUMINA */
                            letter-spacing: 2px;
                            margin: 0;
                            text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
                        }
                        .slogan { font-size: 11px; color: #666; margin-top: 5px; }

                        .info { font-size: 11px; text-align: center; color: #777; margin-bottom: 20px; background: #f8fafc; padding: 10px; border-radius: 6px; }

                        table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 15px; }
                        th { color: #888; text-transform: uppercase; font-size: 11px; padding: 8px 0; border-bottom: 1px solid #eee; }

                        .total-section { 
                            margin-top: 15px; 
                            border-top: 2px solid #facc15; 
                            padding-top: 15px; 
                            font-weight: 900; 
                            font-size: 18px;
                            display: flex;
                            justify-content: space-between;
                            color: #0c1a32; /* Biru Gelap teks */
                        }

                        .actions {
                            margin-top: 30px;
                            display: flex;
                            gap: 12px;
                            width: 100%;
                            position: relative;
                            z-index: 10;
                        }
                        
                        .btn {
                            flex: 1;
                            padding: 14px;
                            border: none;
                            border-radius: 8px;
                            font-weight: 800;
                            font-size: 13px;
                            text-transform: uppercase;
                            cursor: pointer;
                            transition: all 0.2s ease;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 8px;
                        }

                        .btn-print { 
                            background-color: #0c1a32; /* BIRU GELAP TOMBOL PRINT */
                            color: #facc15; /* Kuning untuk teks tombol */
                        }
                        .btn-print:hover { background-color: #1a2f5a; }

                        .btn-close { 
                            background-color: #e2e8f0; 
                            color: #475569; 
                        }
                        .btn-close:hover { background-color: #cbd5e1; }

                        /* ATURAN SAAT DIPRINT (KERTAS FISIK) */
                        @media print {
                            body { background: white !important; padding: 0 !important; min-height: auto !important; }
                            .receipt-card { box-shadow: none !important; width: 100% !important; padding: 15px !important; border-radius: 0 !important; }
                            .receipt-card::before { display: none !important; }
                            .actions { display: none !important; } /* Sembunyikan tombol di kertas */
                            .logo { color: black !important; text-shadow: none !important; } /* Paksa teks hitam di kertas thermal */
                        }
                    </style>
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
                </head>
                <body>
                    <div class="receipt-card">
                        <div class="header">
                            <h1 class="logo">LUMINA</h1>
                            <p class="slogan">Lighting Up Your Shopping Experience</p>
                        </div>
                        
                        <div class="info">
                            <p>TRANSAKSI ID: TRX-${Date.now()}</p>
                            <p>TGL: ${new Date().toLocaleString('id-ID')}</p>
                        </div>

                        <table>
                            <thead>
                                <tr>
                                    <th align="left">ITEM</th>
                                    <th>QTY</th>
                                    <th align="right">SUB</th>
                                </tr>
                            </thead>
                            <tbody>${tableRows}</tbody>
                        </table>

                        <div class="total-section">
                            <span>TOTAL:</span>
                            <span>Rp ${totalVal.toLocaleString()}</span>
                        </div>

                        <div class="actions">
                            <button class="btn btn-print" onclick="window.print()">
                                🖨️ Cetak
                            </button>
                            <button class="btn btn-close" onclick="window.close()">
                                Tutup
                            </button>
                        </div>
                        
                        <p style="text-align:center; font-size: 9px; color: #aaa; margin-top: 25px; border-top: 1px dashed #eee; padding-top: 10px;">
                            Powered by LUMINA System
                        </p>
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();

        // Reset Keranjang di Halaman Utama
        cart = [];
        renderCart();

    } catch (error) {
        console.error("Error Detail:", error);
        alert("Gagal memproses transaksi: " + error.message);
    }
};
window.closeReceiptModal = function() {
    const modal = document.getElementById("receipt-modal");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
};
// Fungsi ini sekarang lebih simpel karena data sudah diisi di processCheckout
window.handlePrintAndClose = function() {
    // 1. Sembunyikan modal sukses
    const successModal = document.getElementById("success-payment-modal");
    if (successModal) {
        successModal.classList.add("hidden");
        successModal.classList.remove("flex");
    }

    // 2. Tampilkan modal struk
    const receiptModal = document.getElementById("receipt-modal");
    if (receiptModal) {
        // PAKSA MUNCUL: Hapus hidden, tambah flex
        receiptModal.classList.remove("hidden");
        receiptModal.style.display = "flex"; 

        console.log("Modal struk dipaksa muncul...");

        // 3. JEDA LEBIH LAMA: Beri waktu 1.5 detik (1500ms) 
        // agar browser benar-benar menggambar tabel produk di layar
        setTimeout(() => {
            window.print();
        }, 1500);
    } else {
        alert("Error: Elemen #receipt-modal tidak ditemukan!");
    }
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
            alert("Produk berhasil dipulihkan!");
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
            alert("Kategori berhasil dipulihkan!");
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
        alert("Data produk belum siap, coba lagi...");
        return;
    }

    const product = window.allProducts.find(p => p.id === productId);

    if (!product) {
        alert("Produk tidak ditemukan!");
        return;
    }

    const barcodeContent = product.barcode || product.name;

    const printWindow = window.open('', '_blank');

printWindow.document.write(`
    <html>
    <head>
        <title>Barcode Label - ${product.name}</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
            
            body { 
                margin: 0; 
                padding: 0; 
                display: flex; 
                flex-direction: column; 
                align-items: center; 
                justify-content: center; 
                min-height: 100vh; 
                background-color: #f1f5f9; 
                font-family: 'Inter', sans-serif;
            }

            .label-container {
                background: white;
                width: 320px;
                padding: 24px;
                border-radius: 16px;
                box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
                border: 1px solid #e2e8f0;
                text-align: center;
                position: relative;
                overflow: hidden;
            }

            /* Efek aksen warna di pinggir label */
            .label-container::before {
                content: "";
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 6px;
        
            }

            .brand-name {
                font-size: 10px;
                font-weight: 800;
                color: #94a3b8;
                text-transform: uppercase;
                letter-spacing: 2px;
                margin-bottom: 8px;
            }

            h2 { 
                margin: 0; 
                font-size: 18px; 
                color: #1e293b; 
                font-weight: 700;
                line-height: 1.2;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }

            .category {
                font-size: 11px;
                color: #64748b;
                background: #f8fafc;
                padding: 4px 12px;
                border-radius: 99px;
                display: inline-block;
                margin-top: 8px;
                border: 1px solid #e2e8f0;
            }

            .barcode-wrapper {
                margin: 20px 0;
                padding: 10px;
                background: white;
            }

            .price-tag {
                font-size: 24px;
                font-weight: 800;
                color: #1e293b;
                margin-top: 5px;
            }

            .footer-info {
                margin-top: 15px;
                padding-top: 15px;
                border-top: 1px dashed #e2e8f0;
                font-size: 10px;
                color: #94a3b8;
            }

            .btn-print {
                margin-top: 25px;
                background: #1e293b;
                color: white;
                border: none;
                padding: 10px 24px;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
            }

            .btn-print:hover {
                background: #000;
                transform: translateY(-1px);
            }

            /* Aturan cetak agar tombol tidak ikut terprint */
            @media print {
                body { background: white; }
                .label-container { box-shadow: none; border: 1px solid #eee; }
                .btn-print { display: none; }
            }
        </style>
    </head>
    <body>
        <div class="label-container">
            <div class="brand-name">LUMINA INVENTORY</div>
            <h2>${product.name}</h2>
            <div class="category">${product.category}</div>
            
            <div class="barcode-wrapper">
                <svg id="barcode"></svg>
            </div>

            <div class="price-tag">Rp ${parseInt(product.price).toLocaleString('id-ID')}</div>
            
        
        </div>

        <button class="btn-print" onclick="window.print()">
            <i class="fas fa-print"></i> Cetak Label
        </button>

        <script>
            window.onload = function() {
                JsBarcode("#barcode", "${barcodeContent}", {
                    format: "CODE128",
                    lineColor: "#1e293b",
                    width: 2,
                    height: 60,
                    displayValue: true,
                    fontSize: 12,
                    fontOptions: "bold",
                    margin: 0
                });
            };
        </script>
    </body>
    </html>
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