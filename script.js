// ==========================================
// 1. KONFIGURASI FIREBASE (AMBIL DARI WINDOW)
// ==========================================
const { collection, addDoc, getDocs, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy } = window.fs;
const db = window.db;
const productsCol = collection(db, "products");

// State Global
let products = [];
let salesHistory = JSON.parse(localStorage.getItem('pos_sales_history')) || [];
let cart = JSON.parse(localStorage.getItem('pos_cart')) || [];
let total = 0;

// ==========================================
// 2. SISTEM LOGIN & AUTHENTICATION
// ==========================================
function checkLoginStatus() {
    const overlay = document.getElementById('login-overlay');
    if (sessionStorage.getItem('isLoggedIn') === 'true') {
        overlay.style.display = 'none';
    } else {
        overlay.style.display = 'flex';
    }
}

function handleLogin() {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    if (user === 'admin' && pass === '123') {
        sessionStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('activeUser', user);
        checkLoginStatus();
        showToast(`Selamat bekerja, ${user}!`);
    } else {
        document.getElementById('login-error').style.display = 'block';
        showToast("Login Gagal!", "error");
    }
}

function handleLogout() {
    if (confirm("Apakah anda yakin ingin keluar?")) {
        sessionStorage.clear();
        location.reload();
    }
}

// ==========================================
// 3. LOGIKA DATABASE (REAL-TIME)
// ==========================================
function listenToProducts() {
    onSnapshot(query(productsCol, orderBy("createdAt", "desc")), (snapshot) => {
        products = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        displayProducts(products); 
        renderAdminTable(products);
    });
}

// ==========================================
// 4. UI FEEDBACK & ADMIN LOGIC (CRUD CLOUD)
// ==========================================
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if(!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'error' : ''}`;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function openAdmin() {
    document.getElementById('admin-modal').style.display = 'flex';
    renderAdminTable();
}

function closeAdmin() {
    document.getElementById('admin-modal').style.display = 'none';
    resetAdminForm();
}

function renderAdminTable(dataToRender = products) {
    const tableBody = document.getElementById('admin-product-table');
    if(!tableBody) return;
    tableBody.innerHTML = '';
    
    dataToRender.forEach(p => {
        const rowStyle = p.isDeleted ? 'style="background: #ffeaea; opacity: 0.7;"' : '';
        const actionButtons = p.isDeleted 
            ? `<button onclick="restoreProduct('${p.id}')" style="background:#28a745; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Pulihkan</button>`
            : `<button onclick="editProduct('${p.id}')" style="background:#ffc107; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; margin-right:5px;">Edit</button>
               <button onclick="deleteProduct('${p.id}')" style="background:#dc3545; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Hapus</button>`;

        tableBody.innerHTML += `
            <tr ${rowStyle} style="border-bottom: 1px solid #ddd;">
                <td style="padding:10px">${p.name} ${p.isDeleted ? '<br><small>(Terhapus)</small>' : ''}</td>
                <td>${p.category}</td>
                <td>Rp ${p.price.toLocaleString()}</td>
                <td>${p.stock}</td>
                <td>${actionButtons}</td>
            </tr>`;
    });
}

async function handleSaveProduct() {
    // FIX: Ambil element input ID agar variabel 'id' terdefinisi
    const idInput = document.getElementById('edit-id');
    const id = idInput ? idInput.value : ''; 

    const name = document.getElementById('prod-name').value;
    const price = parseInt(document.getElementById('prod-price').value);
    const stock = parseInt(document.getElementById('prod-stock').value);
    const category = document.getElementById('prod-category').value;
    const image = document.getElementById('prod-image').value || "img/meja.jpg";

    if (!name || isNaN(price)) return showToast("Nama dan Harga wajib diisi!", "error");

    const productData = { 
        name, price, stock, category, image, 
        isDeleted: false, 
        createdAt: new Date() 
    };

    try {
        console.log("Mengirim ke Cloud...");
        if (id && id !== "") {
            // Update Produk
            const docRef = doc(db, "products", id);
            await updateDoc(docRef, productData);
            showToast("Produk diperbarui!");
        } else {
            // Tambah Produk Baru
            await addDoc(productsCol, productData);
            showToast("Produk disimpan!");
        }
        resetAdminForm();
        closeAdmin();
    } catch (e) {
        console.error("Firebase Error:", e);
        showToast("Gagal: " + e.message, "error");
    }
}

function editProduct(id) {
    const p = products.find(prod => prod.id === id);
    if(!p) return;

    document.getElementById('edit-id').value = p.id;
    document.getElementById('prod-name').value = p.name;
    document.getElementById('prod-price').value = p.price;
    document.getElementById('prod-stock').value = p.stock;
    document.getElementById('prod-category').value = p.category;
    document.getElementById('prod-image').value = p.image;
    document.getElementById('save-btn').innerText = "Update Produk";
}

async function deleteProduct(id) {
    if (confirm("Pindahkan ke tempat sampah?")) {
        try {
            const docRef = doc(db, "products", id);
            await updateDoc(docRef, { isDeleted: true });
            showToast("Produk dihapus", "error");
        } catch (e) { console.error(e); }
    }
}

async function restoreProduct(id) {
    try {
        const docRef = doc(db, "products", id);
        await updateDoc(docRef, { isDeleted: false });
        showToast("Produk dipulihkan!");
    } catch (e) { console.error(e); }
}

function resetAdminForm() {
    const idInput = document.getElementById('edit-id');
    if(idInput) idInput.value = '';
    document.getElementById('prod-name').value = '';
    document.getElementById('prod-price').value = '';
    document.getElementById('prod-stock').value = '';
    document.getElementById('prod-image').value = '';
    document.getElementById('save-btn').innerText = "Simpan Produk";
}

// ==========================================
// 5. LOGIKA KASIR (TRANSAKSIONAL)
// ==========================================
function displayProducts(productsToDisplay) {
    const productContainer = document.getElementById('product-list');
    if(!productContainer) return;
    productContainer.innerHTML = '';
    
    const activeProducts = productsToDisplay.filter(p => !p.isDeleted);

    activeProducts.forEach(product => {
        const isOutOfStock = product.stock <= 0;
        const productDiv = document.createElement('div');
        productDiv.className = 'product-item';
        productDiv.innerHTML = `
            <img src="${product.image}" alt="${product.name}">
            <h3>${product.name}</h3>
            <p>Harga: Rp ${product.price.toLocaleString()}</p>
            <p style="color: ${isOutOfStock ? 'red' : 'green'}; font-weight: bold;">Stok: ${product.stock}</p>
            <button onclick="addToCart('${product.id}')" ${isOutOfStock ? 'disabled' : ''}>
                ${isOutOfStock ? 'Habis' : 'Tambah ke Keranjang'}
            </button>`;
        productContainer.appendChild(productDiv);
    });
}

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (product && product.stock > 0) {
        product.stock--;
        const item = cart.find(c => c.id === productId);
        if (item) item.quantity++;
        else cart.push({ ...product, quantity: 1 });
        saveAndRender();
        showToast(`${product.name} masuk keranjang`);
    }
}

function decreaseQuantity(productId) {
    const itemIndex = cart.findIndex(item => item.id === productId);
    if (itemIndex > -1) {
        const product = products.find(p => p.id === productId);
        if (product) product.stock++;
        cart[itemIndex].quantity--;
        if (cart[itemIndex].quantity === 0) cart.splice(itemIndex, 1);
        saveAndRender();
    }
}

function removeItem(productId) {
    const itemIndex = cart.findIndex(item => item.id === productId);
    if (itemIndex > -1) {
        const product = products.find(p => p.id === productId);
        if (product) product.stock += cart[itemIndex].quantity;
        cart.splice(itemIndex, 1);
        saveAndRender();
    }
}

function saveAndRender() {
    localStorage.setItem('pos_cart', JSON.stringify(cart));
    total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const cartList = document.getElementById('cart-items');
    if(!cartList) return;

    cartList.innerHTML = cart.length === 0 ? '<li>Belum ada barang.</li>' : '';
    
    cart.forEach(item => {
        const li = document.createElement('li');
        li.style.marginBottom = "15px";
        li.innerHTML = `
            <div style="display:flex; justify-content:space-between;">
                <div><strong>${item.name}</strong><br><small>${item.quantity} x Rp ${item.price.toLocaleString()}</small></div>
                <div>
                    <button onclick="decreaseQuantity('${item.id}')" style="padding:2px 8px; background:#ffc107; border:none; border-radius:4px;">-</button>
                    <button onclick="removeItem('${item.id}')" style="padding:2px 8px; background:#dc3545; color:white; border:none; border-radius:4px;">Hapus</button>
                </div>
            </div>`;
        cartList.appendChild(li);
    });
    document.getElementById('total-price').textContent = total.toLocaleString();
    displayProducts(products);
}

// ==========================================
// 6. TRANSAKSI & LAPORAN
// ==========================================
document.getElementById('checkout-btn').addEventListener('click', async () => {
    if (cart.length === 0) return showToast("Keranjang kosong!", "error");
    
    const transaction = { 
        id: "TRX-" + Date.now(), 
        date: new Date().toLocaleString('id-ID'), 
        totalAmount: total, 
        items: [...cart] 
    };

    try {
        // Sync Stok ke Firebase Cloud
        for (const item of cart) {
            const docRef = doc(db, "products", item.id);
            // Ambil stok terbaru dari array produk global
            const currentProd = products.find(p => p.id === item.id);
            await updateDoc(docRef, { stock: currentProd.stock });
        }

        salesHistory.push(transaction);
        localStorage.setItem('pos_sales_history', JSON.stringify(salesHistory));
        
        showReceipt(transaction);
        displaySalesReport();
        
        cart = [];
        localStorage.removeItem('pos_cart');
        saveAndRender();
        showToast("Transaksi Berhasil!");
    } catch (e) {
        console.error(e);
        showToast("Gagal checkout", "error");
    }
});

function displaySalesReport() {
    const salesList = document.getElementById('sales-list');
    const revenueDisplay = document.getElementById('revenue-total');
    if(!salesList || !revenueDisplay) return;

    salesList.innerHTML = '';
    let totalRevenue = 0;
    [...salesHistory].reverse().forEach(sale => {
        totalRevenue += sale.totalAmount;
        salesList.innerHTML += `
            <div style="border-bottom:1px solid #eee; padding:5px 0; font-size:12px">
                <b>${sale.id}</b><br>${sale.date}<br><span style="color:blue">Rp ${sale.totalAmount.toLocaleString()}</span>
            </div>`;
    });
    revenueDisplay.textContent = totalRevenue.toLocaleString();
}

function showReceipt(transaction) {
    document.getElementById('receipt-date').innerText = transaction.date;
    document.getElementById('receipt-content').innerHTML = transaction.items.map(item => `
        <div style="display:flex; justify-content:space-between">
            <span>${item.name} x${item.quantity}</span>
            <span>Rp ${(item.price * item.quantity).toLocaleString()}</span>
        </div>`).join('');
    document.getElementById('receipt-total').innerText = "TOTAL: Rp " + transaction.totalAmount.toLocaleString();
    document.getElementById('receipt-modal').style.display = 'flex';
}

function closeReceipt() { document.getElementById('receipt-modal').style.display = 'none'; }
function printReceipt() { window.print(); }
function clearSales() { if(confirm("Hapus semua laporan?")) { salesHistory=[]; localStorage.removeItem('pos_sales_history'); displaySalesReport(); } }

// ==========================================
// 7. FILTER & SEARCH
// ==========================================
function filterCategory(categoryName) {
    const filtered = categoryName === 'Semua' ? products : products.filter(p => p.category === categoryName);
    displayProducts(filtered);
}

document.getElementById('search-input').addEventListener('input', (e) => {
    const keyword = e.target.value.toLowerCase();
    const filtered = products.filter(p => p.name.toLowerCase().includes(keyword));
    displayProducts(filtered);
});

const adminSearch = document.getElementById('admin-search-input');
if(adminSearch) {
    adminSearch.addEventListener('input', function(e) {
        const keyword = e.target.value.toLowerCase();
        const filteredForAdmin = products.filter(p => 
            p.name.toLowerCase().includes(keyword) || 
            p.category.toLowerCase().includes(keyword)
        );
        renderAdminTable(filteredForAdmin);
    });
}

// ==========================================
// 8. INITIALIZATION
// ==========================================
checkLoginStatus();
listenToProducts(); 
saveAndRender();
displaySalesReport();