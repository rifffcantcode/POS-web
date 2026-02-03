import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// --- STATE MANAGEMENT ---
let allProducts = [];
let cart = [];
let currentCategory = "Semua";
let searchQuery = "";

// 1. Initial Load Cart
try {
  const savedCart = localStorage.getItem("lumina_cart");
  if (savedCart) {
    cart = JSON.parse(savedCart).map(item => ({
      ...item,
      price: Number(item.price) || 0,
      quantity: Number(item.quantity) || 1
    }));
  }
} catch (e) { cart = []; }

// 2. Real-time Database (Firestore)
onSnapshot(collection(db, "products"), (snapshot) => {
  allProducts = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    if (!data.isDeleted) {
      allProducts.push({ 
        id: doc.id, 
        ...data,
        price: Number(data.price) || 0,
        stock: Number(data.stock) || 0 
      });
    }
  });
  
  const loadingStatus = document.getElementById("loading-status");
  if(loadingStatus) loadingStatus.style.display = "none";
  
  renderProducts(true); // Animasi aktif saat pertama kali load data
  updateCartCount();
});

// 3. Render Produk ke Katalog (Dengan Logika Stagger yang bisa dimatikan)
window.renderProducts = (withAnimation = true) => {
  const grid = document.getElementById("customer-product-grid");
  if (!grid) return;
  grid.innerHTML = "";
  
  const filtered = allProducts.filter(p => {
    const matchCat = currentCategory === "Semua" || p.category === currentCategory;
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="col-span-full text-center py-20 text-gray-400 font-bold uppercase tracking-widest text-sm">Produk tidak ditemukan</div>`;
    return;
  }

  filtered.forEach((p, i) => {
    const itemInCart = cart.find(item => item.id === p.id);
    const availableStock = p.stock - (itemInCart ? itemInCart.quantity : 0);
    
    // Logika Stagger
    const delay = i * 0.1; 
    const animationClass = withAnimation ? "reveal-card" : "";
    const animationDelay = withAnimation ? `style="animation-delay: ${delay}s"` : "";

    grid.innerHTML += `
      <div class="glass-card ${animationClass} rounded-2xl overflow-hidden flex flex-col group relative shadow-sm" 
           ${animationDelay}>
          <div onclick="openProductDetail('${p.id}')" class="w-full h-64 bg-white/40 p-6 flex items-center justify-center cursor-pointer relative overflow-hidden">
              <img src="${p.image}" class="object-contain w-full h-full mix-blend-multiply group-hover:scale-110 transition-transform duration-700" onerror="this.src='https://via.placeholder.com/300?text=No+Image'">
              
              ${availableStock <= 0 ? 
                  '<div class="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center text-white font-bold text-xs uppercase tracking-widest">Stok Habis</div>' 
                  : ''}
              
              <div class="absolute top-3 left-3">
                  <span class="text-[9px] font-bold text-lumina-dark bg-white/80 backdrop-blur-md px-2 py-1 rounded-full uppercase tracking-tighter border border-white/50 shadow-sm">
                      ${p.category}
                  </span>
              </div>
          </div>

          <div class="p-5 flex-grow flex flex-col">
              <h4 onclick="openProductDetail('${p.id}')" class="text-md font-bold text-lumina-dark mb-1 hover:text-lumina-gold cursor-pointer line-clamp-2 transition-colors">
                  ${p.name}
              </h4>
              
              <div class="mt-auto flex items-center justify-between pt-4">
                  <div>
                      <p class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Price</p>
                      <p class="text-lg font-black text-lumina-gold">Rp ${p.price.toLocaleString('id-ID')}</p>
                  </div>
                  
                  <button onclick="addToCartCustomer('${p.id}', event)" ${availableStock <= 0 ? 'disabled' : ''} 
                      class="${availableStock > 0 ? 'bg-lumina-dark text-white hover:bg-black shadow-lg' : 'bg-gray-200 text-gray-400'} 
                      w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-95">
                      <i class="fas fa-plus"></i>
                  </button>
              </div>
          </div>
      </div>`;
  });
};

// 4. Detail Produk Modal
window.openProductDetail = (productId) => {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;

  const modal = document.getElementById("product-detail-modal");
  const detailContent = document.getElementById("detail-content");
  if (!modal || !detailContent) return;

  const itemInCart = cart.find(item => item.id === productId);
  const availableStock = product.stock - (itemInCart ? itemInCart.quantity : 0);

  detailContent.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div class="bg-gray-50 rounded-2xl p-8 flex items-center justify-center">
        <img src="${product.image}" class="max-h-80 object-contain mix-blend-multiply" onerror="this.src='https://via.placeholder.com/300'">
      </div>
      <div class="flex flex-col">
        <span class="text-xs font-bold text-lumina-gold uppercase tracking-widest">${product.category}</span>
        <h2 class="text-3xl font-bold text-lumina-dark mt-2 mb-4">${product.name}</h2>
        <p class="text-2xl font-bold text-lumina-dark mb-6">Rp ${product.price.toLocaleString('id-ID')}</p>
        
        <div class="border-t border-b py-6 mb-6">
          <h5 class="text-sm font-bold text-gray-400 uppercase mb-2">Deskripsi Produk</h5>
          <p class="text-gray-600 leading-relaxed">${product.description || 'Tidak ada deskripsi untuk produk ini.'}</p>
        </div>

        <div class="mt-auto flex gap-4">
          <button onclick="addToCartCustomer('${product.id}', event)" ${availableStock <= 0 ? 'disabled' : ''} 
            class="flex-grow ${availableStock > 0 ? 'bg-lumina-dark hover:bg-black' : 'bg-gray-300'} text-white py-4 rounded-xl font-bold transition flex items-center justify-center gap-2">
            <i class="fas fa-shopping-cart"></i> ${availableStock > 0 ? 'TAMBAH KE KERANJANG' : 'STOK HABIS'}
          </button>
        </div>
        <p class="text-xs text-gray-400 mt-4 italic">* Sisa stok: ${availableStock} unit</p>
      </div>
    </div>
  `;
  modal.classList.remove("hidden");
  modal.classList.add("flex");
};

// 5. Add to Cart dengan Efek "Fly" & Pesan Limit
window.addToCartCustomer = (productId, event) => {
    const product = allProducts.find(p => p.id === productId);
    const itemInCart = cart.find(item => item.id === productId);
    const currentQty = itemInCart ? itemInCart.quantity : 0;

    // Cek Limit Stok
    if (currentQty >= product.stock) {
        showToast("Maaf, jumlah pesanan sudah mencapai batas stok!", "error");
        return;
    }

    // Efek Animasi Terbang (Hanya jika event klik tersedia)
    if (event) {
        const btn = event.currentTarget;
        const rect = btn.getBoundingClientRect();
        const cartIcon = document.querySelector('.fa-shopping-bag').getBoundingClientRect();

        const flyer = document.createElement('img');
        flyer.src = product.image;
        flyer.className = 'flying-item';
        flyer.style.left = `${rect.left}px`;
        flyer.style.top = `${rect.top}px`;
        document.body.appendChild(flyer);

        setTimeout(() => {
            flyer.style.left = `${cartIcon.left}px`;
            flyer.style.top = `${cartIcon.top}px`;
            flyer.style.transform = 'scale(0.2)';
            flyer.style.opacity = '0';
        }, 50);
        setTimeout(() => flyer.remove(), 800);
    }

    // Update Data
    if (itemInCart) {
        itemInCart.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    
    // Save tanpa men-trigger stagger animation ulang
    saveAndRefresh(false); 
    showToast(`${product.name} berhasil ditambahkan!`);
};

// 6. Sinkronisasi Data & UI
window.saveAndRefresh = (animate = true) => {
    localStorage.setItem('lumina_cart', JSON.stringify(cart));
    updateCartCount();
    renderProducts(animate);
    if (!document.getElementById("cart-modal").classList.contains("hidden")) {
        renderCart();
    }
};

function updateCartCount() {
    const total = cart.reduce((sum, i) => sum + i.quantity, 0);
    const el = document.getElementById("cart-count");
    if(el) {
        el.innerText = total;
        el.classList.toggle("hidden", total === 0);
    }
}

// 7. Cart UI & Modal
window.renderCart = () => {
  const list = document.getElementById("cart-items-list");
  const totalEl = document.getElementById("cart-total");
  if(!list || !totalEl) return;

  let total = 0;
  list.innerHTML = cart.length ? "" : '<p class="text-center py-10 text-gray-400">Keranjang Kosong</p>';
  
  cart.forEach((item, idx) => {
    total += (item.price * item.quantity);
    list.innerHTML += `
      <div class="flex items-center gap-4 bg-white p-3 rounded-lg border">
        <img src="${item.image}" class="w-12 h-12 object-contain" onerror="this.src='https://via.placeholder.com/100'">
        <div class="flex-grow">
            <h5 class="text-sm font-bold truncate">${item.name}</h5>
            <p class="text-xs text-gray-400">${item.quantity}x Rp ${item.price.toLocaleString()}</p>
        </div>
        <button onclick="removeFromCart(${idx})" class="text-red-400 hover:text-red-600 transition"><i class="fas fa-trash"></i></button>
      </div>`;
  });
  totalEl.innerText = `Rp ${total.toLocaleString('id-ID')}`;
};

window.toggleCartModal = () => {
  document.getElementById("cart-modal").classList.toggle("hidden");
  renderCart();
};

window.removeFromCart = (idx) => { 
    cart.splice(idx, 1); 
    saveAndRefresh(true); // Pas hapus barang, boleh pakai stagger lagi biar segar
};

// 8. Navigasi & Filter (Informa Style)
window.filterCategory = (cat) => {
    currentCategory = cat;
    const titleEl = document.getElementById("katalog-title");
    if(titleEl) titleEl.innerText = cat === "Semua" ? "Koleksi Terbaru" : "Koleksi " + cat;
    
    // Update URL Parameter
    const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?category=' + encodeURIComponent(cat);
    window.history.pushState({ path: newUrl }, '', newUrl);

    // Update UI Tombol
    document.querySelectorAll(".category-btn").forEach(btn => {
        const active = btn.innerText.trim() === cat;
        btn.className = active 
            ? "category-btn px-6 py-2 rounded-full border border-lumina-dark bg-lumina-dark text-white font-medium shadow-md text-sm transition" 
            : "category-btn px-6 py-2 rounded-full border border-gray-300 text-gray-500 font-medium hover:border-lumina-dark hover:text-lumina-dark transition text-sm";
    });
    
    renderProducts(true); // Pakai stagger saat ganti kategori
};

// 9. Admin & Login
window.checkLogin = () => {
  const passwordInput = document.getElementById("admin-password");
  if (passwordInput.value === "admin123") {
    showToast("Akses Diterima! Mengalihkan...");
    setTimeout(() => { window.location.href = "index.html"; }, 1000);
  } else {
    showToast("Sandi salah! Akses ditolak.", "error");
    passwordInput.value = "";
    passwordInput.focus();
  }
};

window.openLoginModal = () => {
  const modal = document.getElementById("login-modal");
  if(modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    document.getElementById("admin-password").focus();
  }
};

window.closeLoginModal = () => {
  const modal = document.getElementById("login-modal");
  if(modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
};

window.closeProductDetail = () => {
    document.getElementById("product-detail-modal").classList.add("hidden");
};

// 10. Utils
window.handleSearch = (e) => { 
    searchQuery = e.target.value; 
    renderProducts(false); // Pencarian jangan pakai stagger agar tidak pusing
};

window.showToast = (msg, type = "success") => {
  const toast = document.createElement("div");
  const isError = type === "error";
  toast.className = `fixed bottom-5 left-1/2 -translate-x-1/2 bg-white px-6 py-3 rounded-full shadow-2xl border flex items-center gap-3 z-[100] transition-all duration-500 transform translate-y-20 opacity-0`;
  
  toast.innerHTML = `
    <i class="fas ${isError ? 'fa-exclamation-circle text-red-500' : 'fa-check-circle text-green-500'}"></i> 
    <span class="text-sm font-bold text-lumina-dark">${msg}</span>
  `;
  
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.remove("translate-y-20", "opacity-0"), 100);
  setTimeout(() => {
    toast.classList.add("translate-y-20", "opacity-0");
    setTimeout(() => toast.remove(), 500);
  }, 2500);
};

window.checkoutWhatsApp = () => {
    if (!cart.length) return alert("Keranjang masih kosong!");
    let msg = "*PESANAN BARU - LUMINA*\n--------------------------\n";
    let total = 0;
    cart.forEach(i => {
        msg += `• ${i.name} (${i.quantity}x) - Rp ${(i.price * i.quantity).toLocaleString()}\n`;
        total += (i.price * i.quantity);
    });
    msg += `--------------------------\n*Total Bayar: Rp ${total.toLocaleString('id-ID')}*`;
    window.open(`https://wa.me/6281210680152?text=${encodeURIComponent(msg)}`);
};

// 11. Initializer
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const categoryFromUrl = urlParams.get('category');
    if (categoryFromUrl) {
        filterCategory(categoryFromUrl);
    }
});

window.onpopstate = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const categoryFromUrl = urlParams.get('category') || "Semua";
    filterCategory(categoryFromUrl);
};

// Fungsi untuk menampilkan skeleton loading
window.showSkeleton = () => {
  const grid = document.getElementById("customer-product-grid");
  if (!grid) return;
  
  grid.innerHTML = "";
  // Tampilkan 8 kartu skeleton sebagai placeholder
  for (let i = 0; i < 8; i++) {
    grid.innerHTML += `
      <div class="skeleton-card shadow-sm border border-gray-100">
        <div class="skeleton w-full h-52 mb-4"></div> <div class="skeleton w-1/3 h-3 mb-2"></div>   <div class="skeleton w-full h-5 mb-4"></div>  <div class="mt-auto flex justify-between items-center">
          <div class="w-1/2">
            <div class="skeleton w-1/2 h-3 mb-2"></div>
            <div class="skeleton w-full h-6"></div>
          </div>
          <div class="skeleton w-12 h-12 rounded-xl"></div> </div>
      </div>
    `;
  }
};

// Panggil skeleton sebelum database di-load
showSkeleton();

onSnapshot(collection(db, "products"), (snapshot) => {
  allProducts = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    if (!data.isDeleted) {
      allProducts.push({ 
        id: doc.id, 
        ...data,
        price: Number(data.price) || 0,
        stock: Number(data.stock) || 0 
      });
    }
  });
  
  // Sembunyikan status loading lama jika ada
  const loadingStatus = document.getElementById("loading-status");
  if(loadingStatus) loadingStatus.style.display = "none";
  
  // RenderProducts otomatis menggantikan isi grid (skeleton hilang)
  renderProducts(true);
  updateCartCount();
});