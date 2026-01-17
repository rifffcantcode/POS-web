// ==========================================
// 1. SISTEM LOGIN & AUTHENTICATION
// ==========================================

function checkLoginStatus() {
    const overlay = document.getElementById('login-overlay');
    const isLoggedIn = sessionStorage.getItem('isLoggedIn');
    if (isLoggedIn === 'true') {
        overlay.style.display = 'none';
    } else {
        overlay.style.display = 'flex';
    }
}

function handleLogin() {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const errorMsg = document.getElementById('login-error');

    // Kredensial default (bisa kamu ganti)
    if (user === 'admin' && pass === '123') {
        sessionStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('activeUser', user);
        checkLoginStatus();
        showToast(`Selamat bekerja, ${user}!`);
    } else {
        errorMsg.style.display = 'block';
        showToast("Login Gagal!", "error");
    }
}

function handleLogout() {
    if (confirm("Apakah anda yakin ingin keluar?")) {
        sessionStorage.removeItem('isLoggedIn');
        sessionStorage.removeItem('activeUser');
        location.reload();
    }
}

// ==========================================
// 2. DATA PRODUK & STATE APLIKASI
// ==========================================

let salesHistory = JSON.parse(localStorage.getItem('pos_sales_history')) || [];
let cart = JSON.parse(localStorage.getItem('pos_cart')) || [];
let total = 0;

const products = [
    { id: 1, name: "Meja Kayu Minimalis", price: 500000, image: "img/meja.jpg", category: "Furniture", stock: 10 },
    { id: 2, name: "Kursi Kantor", price: 750000, image: "img/kursi_kantor.webp", category: "Furniture", stock: 5 },
    { id: 3, name: "Lampu Belajar", price: 150000, image: "img/lampu_belajar.jpg", category: "Elektronik", stock: 8 },
    { id: 4, name: "Rak Buku", price: 300000, image: "img/rak_buku.jpg", category: "Furniture", stock: 12 },
    { id: 5, name: "Kursi Tamu", price: 600000, image: "img/kursi_tamu.jpg", category: "Furniture", stock: 7 },
    { id: 6, name: "Speaker Bluetooth", price: 250000, image: "img/speaker_bluetooth.jpg", category: "Elektronik", stock: 6 },
    { id: 7, name: "Jam Dinding Modern", price: 120000, image: "img/jamdinding_modern.jpg", category: "Dekorasi", stock: 15 },
    { id: 8, name: "Vas Bunga Keramik", price: 80000, image: "img/vas_bunga.jpg", category: "Dekorasi", stock: 20 },
    { id: 9, name: "Karpet Lantai", price: 200000, image: "img/karpet_lantai.jpg", category: "Dekorasi", stock: 18 },
    { id: 10, name: "Meja Belajar Anak", price: 450000, image: "img/meja_belajar.jpg", category: "Furniture", stock: 9 }
];

// ==========================================
// 3. UI FEEDBACK (TOAST)
// ==========================================

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'error' : ''}`;
    const icon = type === 'success' ? '✅' : '❌';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ==========================================
// 4. LOGIKA KASIR (KERANJANG & STOK)
// ==========================================

function displayProducts(productsToDisplay) {
    const productContainer = document.getElementById('product-list');
    productContainer.innerHTML = '';
    productsToDisplay.forEach(product => {
        const isOutOfStock = product.stock <= 0;
        const productDiv = document.createElement('div');
        productDiv.className = 'product-item';
        productDiv.innerHTML = `
            <img src="${product.image}" alt="${product.name}">
            <h3>${product.name}</h3>
            <p>Harga: Rp ${product.price.toLocaleString()}</p>
            <p style="color: ${isOutOfStock ? 'red' : 'green'}; font-weight: bold;">Stok: ${product.stock}</p>
            <button onclick="addToCart(${product.id})" ${isOutOfStock ? 'disabled' : ''}>
                ${isOutOfStock ? 'Habis' : 'Tambah ke Keranjang'}
            </button>
        `;
        productContainer.appendChild(productDiv);
    });
}

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (product.stock > 0) {
        product.stock--;
        const item = cart.find(c => c.id === productId);
        if (item) item.quantity++;
        else cart.push({ ...product, quantity: 1 });
        saveAndRender();
        showToast(`${product.name} masuk keranjang`);
    } else {
        showToast("Stok Habis!", "error");
    }
}

function decreaseQuantity(productId) {
    const itemIndex = cart.findIndex(item => item.id === productId);
    
    if (itemIndex > -1) {
        const cartItem = cart[itemIndex];
        const product = products.find(p => p.id === productId);
        
        // Kembalikan stok ke daftar produk
        if (product) product.stock += 1;
        
        // Kurangi jumlah di keranjang
        cartItem.quantity -= 1;
        
        // Jika jumlah jadi 0, hapus dari keranjang
        if (cartItem.quantity === 0) {
            cart.splice(itemIndex, 1);
            showToast("Barang dihapus dari keranjang", "error");
        } else {
            showToast("Jumlah barang dikurangi");
        }
    }
    saveAndRender();
}

function removeItem(productName) {
    const itemIndex = cart.findIndex(item => item.name === productName);
    if (itemIndex > -1) {
        const cartItem = cart[itemIndex];
        const product = products.find(p => p.name === productName);
        
        // Kembalikan semua stok yang sempat diambil oleh item ini
        if (product) {
            product.stock += cartItem.quantity;
        }
        
        cart.splice(itemIndex, 1);
        saveAndRender();
        showToast(`Semua ${productName} dihapus`, "error");
    }
}

function saveAndRender() {
    localStorage.setItem('pos_cart', JSON.stringify(cart));
    total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Update UI Keranjang
    const cartList = document.getElementById('cart-items');
    cartList.innerHTML = cart.length === 0 ? '<li>Belum ada barang.</li>' : '';
    
    cart.forEach(item => {
        const li = document.createElement('li');
        li.style.marginBottom = "15px";
        li.style.paddingBottom = "10px";
        li.style.borderBottom = "1px solid #eee";
        
        li.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:start;">
                <div style="flex:1;">
                    <strong style="display:block; font-size:14px;">${item.name}</strong>
                    <small style="color:var(--text-muted);">
                        ${item.quantity} x Rp ${item.price.toLocaleString()}
                    </small>
                </div>
                <div style="display:flex; gap:5px; align-items:center;">
                    <button onclick="decreaseQuantity(${item.id})" 
                        style="width:30px; height:30px; padding:0; background:var(--warning-color); color:#333; border-radius:5px;">
                        -
                    </button>
                    
                    <button onclick="removeItem('${item.name}')" 
                        style="width:auto; height:30px; padding:0 10px; background:var(--danger-color); color:white; border-radius:5px; font-size:12px;">
                        Hapus
                    </button>
                </div>
            </div>
            <div style="text-align:right; font-weight:600; font-size:14px; margin-top:5px;">
                Rp ${(item.price * item.quantity).toLocaleString()}
            </div>
        `;
        cartList.appendChild(li);
    });
    
    document.getElementById('total-price').textContent = total.toLocaleString();
    displayProducts(products); // Render ulang daftar produk untuk update stok
}
// ==========================================
// 5. TRANSAKSI & STRUK
// ==========================================

function showReceipt(transaction) {
    const receiptDate = document.getElementById('receipt-date');
    const receiptContent = document.getElementById('receipt-content');
    const receiptTotal = document.getElementById('receipt-total');
    const modal = document.getElementById('receipt-modal');

    // Isi tanggal
    receiptDate.innerText = transaction.date;

    // Isi daftar barang
    receiptContent.innerHTML = transaction.items.map(item => `
        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <span>${item.name} x${item.quantity}</span>
            <span>Rp ${(item.price * item.quantity).toLocaleString()}</span>
        </div>
    `).join('');

    // Isi total harga
    receiptTotal.innerText = "TOTAL: Rp " + transaction.totalAmount.toLocaleString();

    // Tampilkan modal
    modal.style.display = 'flex';
}

document.getElementById('checkout-btn').addEventListener('click', () => {
    if (cart.length === 0) {
        showToast("Keranjang masih kosong!", "error");
        return;
    }

    // 1. Buat Objek Transaksi
    const transaction = {
        id: "TRX-" + Date.now(),
        date: new Date().toLocaleString('id-ID'),
        totalAmount: total,
        items: [...cart]
    };

    // 2. Simpan ke riwayat
    salesHistory.push(transaction);
    localStorage.setItem('pos_sales_history', JSON.stringify(salesHistory));

    // 3. Tampilkan Struk (Panggil fungsi yang dibuat di atas)
    showReceipt(transaction); 

    // 4. Update tampilan Laporan
    displaySalesReport();

    // 5. Kosongkan Keranjang & Reset State
    cart = [];
    localStorage.removeItem('pos_cart'); // Hapus dari memori browser
    saveAndRender(); // Sinkronkan UI (Keranjang akan otomatis kosong di layar)
    
    showToast("Transaksi Berhasil!");
});

function displaySalesReport() {
    const salesList = document.getElementById('sales-list');
    const revenueDisplay = document.getElementById('revenue-total');
    
    if (!salesList || !revenueDisplay) return;

    salesList.innerHTML = ''; // Bersihkan list lama
    let totalRevenue = 0;

    // Urutkan dari yang terbaru (paling atas)
    const sortedHistory = [...salesHistory].reverse();

    sortedHistory.forEach(sale => {
        totalRevenue += sale.totalAmount;
        const div = document.createElement('div');
        div.className = 'sale-entry'; // Tambahkan class untuk styling CSS jika perlu
        div.style.padding = "8px 0";
        div.style.borderBottom = "1px solid #eee";
        div.innerHTML = `
            <div style="font-weight:bold; font-size:12px;">${sale.id}</div>
            <div style="font-size:11px; color:#666;">${sale.date}</div>
            <div style="color:var(--accent-color); font-weight:bold;">Rp ${sale.totalAmount.toLocaleString()}</div>
        `;
        salesList.appendChild(div);
    });

    revenueDisplay.textContent = totalRevenue.toLocaleString();
}

// Fungsi Modal
function closeReceipt() { document.getElementById('receipt-modal').style.display = 'none'; }
function printReceipt() { window.print(); }
function clearSales() { if(confirm("Hapus semua?")) { salesHistory=[]; localStorage.removeItem('pos_sales_history'); displaySalesReport(); } }

// ==========================================
// 6. INIT
// ==========================================
checkLoginStatus();
displayProducts(products);
saveAndRender();
displaySalesReport();