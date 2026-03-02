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

// ============================================================
// 1. INITIAL LOAD & FIX GHOST ITEM (PERBAIKAN UTAMA)
// ============================================================
try {
  const savedCart = localStorage.getItem("lumina_cart");
  if (savedCart) {
    const parsed = JSON.parse(savedCart);
    
    // FILTER PEMBERSIH: Hanya ambil item yang punya ID valid
    // Ini akan otomatis membuang "Sofa Velvet Emerald" yang datanya rusak
    cart = parsed
      .filter(item => item.id && item.name) 
      .map(item => ({
        ...item,
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 1
      }));

    // Simpan ulang versi bersihnya agar masalah tidak muncul lagi
    localStorage.setItem("lumina_cart", JSON.stringify(cart));
  }
} catch (e) { 
  console.error("Data keranjang corrupt, reset total.", e);
  cart = []; 
  localStorage.removeItem("lumina_cart");
}

// ============================================================
// 2. SKELETON LOADING (Visual Feedback)
// ============================================================
window.showSkeleton = () => {
  const grid = document.getElementById("customer-product-grid");
  if (!grid) return;
  
  grid.innerHTML = "";
  // Tampilkan 8 kartu skeleton sebagai placeholder
  for (let i = 0; i < 8; i++) {
    grid.innerHTML += `
      <div class="skeleton-card shadow-sm border border-gray-100 p-4 rounded-2xl bg-white">
        <div class="skeleton w-full h-52 mb-4 bg-gray-200 animate-pulse rounded-xl"></div> 
        <div class="skeleton w-1/3 h-3 mb-2 bg-gray-200 animate-pulse rounded"></div>   
        <div class="skeleton w-full h-5 mb-4 bg-gray-200 animate-pulse rounded"></div>  
        <div class="mt-auto flex justify-between items-center">
          <div class="w-1/2">
            <div class="skeleton w-1/2 h-3 mb-2 bg-gray-200 animate-pulse rounded"></div>
            <div class="skeleton w-full h-6 bg-gray-200 animate-pulse rounded"></div>
          </div>
          <div class="skeleton w-12 h-12 rounded-xl bg-gray-200 animate-pulse"></div> 
        </div>
      </div>
    `;
  }
};

// Panggil skeleton sebelum database connect
window.showSkeleton();

// ============================================================
// 3. REAL-TIME DATABASE (SINGLE LISTENER)
// ============================================================
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
  
  // Matikan loading spinner jika ada
  const loadingStatus = document.getElementById("loading-status");
  if(loadingStatus) loadingStatus.style.display = "none";
  
  // Render ulang
  renderProducts(true); 
  updateCartCount();
});

// ============================================================
// 4. RENDER PRODUK (KATALOG)
// ============================================================
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
    
    // Logika Stagger Animation
    const delay = i * 0.1; 
    
    // Build HTML Card
    grid.innerHTML += `
    <div class="glass-card reveal-card rounded-2xl overflow-hidden flex flex-col group relative shadow-sm bg-white" 
         style="animation-delay: ${delay}s">
        
        <div onclick="openProductDetail('${p.id}')" 
             class="product-image-container w-full h-64 p-6 cursor-pointer bg-gray-50 relative overflow-hidden">
            
            <img src="${p.image}" 
                 class="object-contain w-full h-full mix-blend-multiply group-hover:scale-110 transition-transform duration-700" 
                 onerror="this.src='https://via.placeholder.com/300?text=No+Image'">
            
            ${availableStock <= 0 ? 
                '<div class="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center text-white font-bold text-xs uppercase tracking-widest z-10">Stok Habis</div>' 
                : ''}
            
            <div class="absolute top-3 left-3 z-10">
                <span class="text-[9px] font-bold text-lumina-dark bg-white/90 backdrop-blur-md px-2 py-1 rounded-full uppercase tracking-tighter border border-white/50 shadow-sm">
                    ${p.category}
                </span>
            </div>
        </div>

        <div class="p-5 flex-grow flex flex-col"> 
            <h4 onclick="openProductDetail('${p.id}')" class="text-md font-bold text-lumina-dark mb-1 hover:text-lumina-gold cursor-pointer line-clamp-2 transition-colors">
                ${p.name}
            </h4>
              
            <div class="mt-auto flex items-center justify-between pt-4 border-t border-gray-100 mt-4">
                <div>
                    <p class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Price</p>
                    <p class="text-lg font-black text-lumina-gold">Rp ${p.price.toLocaleString('id-ID')}</p>
                </div>
                
                <button onclick="addToCartCustomer('${p.id}', event)" ${availableStock <= 0 ? 'disabled' : ''} 
                    class="${availableStock > 0 ? 'bg-lumina-dark text-white hover:bg-black shadow-lg' : 'bg-gray-200 text-gray-400 cursor-not-allowed'} 
                    w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-95">
                    <i class="fas fa-plus"></i>
                </button>
            </div>
        </div>
    </div>`;
  });
};

// ============================================================
// 5. DETAIL PRODUK MODAL
// ============================================================
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
          <p class="text-gray-600 leading-relaxed text-sm">${product.description || 'Tidak ada deskripsi untuk produk ini.'}</p>
        </div>

        <div class="mt-auto flex gap-4">
          <button onclick="addToCartCustomer('${product.id}', event)" ${availableStock <= 0 ? 'disabled' : ''} 
            class="flex-grow ${availableStock > 0 ? 'bg-lumina-dark hover:bg-black' : 'bg-gray-300 cursor-not-allowed'} text-white py-4 rounded-xl font-bold transition flex items-center justify-center gap-2">
            <i class="fas fa-shopping-cart"></i> ${availableStock > 0 ? 'TAMBAH KE KERANJANG' : 'STOK HABIS'}
          </button>
        </div>
        <p class="text-xs text-gray-400 mt-4 italic">* Sisa stok tersedia: ${availableStock} unit</p>
      </div>
    </div>
  `;
  modal.classList.remove("hidden");
  modal.classList.add("flex");
};

window.closeProductDetail = () => {
    document.getElementById("product-detail-modal").classList.add("hidden");
    document.getElementById("product-detail-modal").classList.remove("flex");
};

// ============================================================
// 6. KERANJANG (ADD, UPDATE, REMOVE)
// ============================================================
window.addToCartCustomer = (productId, event) => {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    const itemInCart = cart.find(item => item.id === productId);
    const currentQty = itemInCart ? itemInCart.quantity : 0;

    // Cek Limit Stok
    if (currentQty >= product.stock) {
        showToast("Maaf, jumlah pesanan sudah mencapai batas stok!", "error");
        return;
    }

    // Efek Animasi Terbang
    if (event) {
        try {
            const btn = event.currentTarget;
            const rect = btn.getBoundingClientRect();
            // Cari icon tas belanja, kalau di mobile mungkin beda elemen
            const cartIcon = document.querySelector('.fa-shopping-bag').getBoundingClientRect();

            const flyer = document.createElement('img');
            flyer.src = product.image;
            flyer.className = 'flying-item fixed z-[9999] w-16 h-16 object-cover rounded-full border-2 border-lumina-gold';
            flyer.style.left = `${rect.left}px`;
            flyer.style.top = `${rect.top}px`;
            flyer.style.transition = "all 0.8s cubic-bezier(0.19, 1, 0.22, 1)";
            document.body.appendChild(flyer);

            setTimeout(() => {
                flyer.style.left = `${cartIcon.left}px`;
                flyer.style.top = `${cartIcon.top}px`;
                flyer.style.opacity = '0';
                flyer.style.transform = 'scale(0.1)';
            }, 50);

            setTimeout(() => flyer.remove(), 800);
        } catch(err) {
            console.log("Animation skipped");
        }
    }

    // Update Data Keranjang
    if (itemInCart) {
        itemInCart.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    
    saveAndRefresh(false); 
    showToast(`${product.name} berhasil ditambahkan!`);
};

window.updateQty = (id, change) => {
    const item = cart.find(p => p.id === id);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            window.removeFromCart(id);
        } else {
            // Validasi Stok
            const productData = allProducts.find(p => p.id === id);
            if (productData && item.quantity > productData.stock) {
                showToast(`Stok hanya tersedia ${productData.stock}!`, "error");
                item.quantity = productData.stock;
            }
            saveAndRefresh(false);
        }
    }
};

window.removeFromCart = (id) => { 
    // Filter cart: Buang item dengan ID tersebut
    cart = cart.filter(item => item.id !== id);
    saveAndRefresh(true); 
};

window.saveAndRefresh = (animate = true) => {
    localStorage.setItem('lumina_cart', JSON.stringify(cart));
    updateCartCount();
    // Render ulang produk untuk update status tombol (stok berkurang)
    renderProducts(false); 
    
    // Jika modal keranjang terbuka, render ulang isinya
    const cartModal = document.getElementById("cart-modal");
    if (cartModal && !cartModal.classList.contains("hidden")) {
        renderCart();
    }
};

function updateCartCount() {
    const total = cart.reduce((sum, i) => sum + i.quantity, 0);
    
    const elDesktop = document.getElementById("cart-count");
    if(elDesktop) {
        elDesktop.innerText = total;
        elDesktop.classList.toggle("hidden", total === 0);
    }

    const elMobile = document.getElementById("cart-count-mobile");
    if(elMobile) {
        elMobile.innerText = total;
        elMobile.classList.toggle("hidden", total === 0);
    }
}

// ============================================================
// 7. RENDER CART MODAL & CHECKOUT
// ============================================================
window.renderCart = () => {
  const container = document.getElementById("cart-items");
  const totalEl = document.getElementById("cart-total");
  
  if(!container || !totalEl) return;

  let total = 0;
  
  if (cart.length === 0) {
      container.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full text-center text-gray-400">
            <i class="fas fa-shopping-bag text-6xl mb-4 opacity-20"></i>
            <p class="font-medium">Keranjang masih kosong.</p>
            <button onclick="toggleCartModal()" class="mt-4 text-lumina-gold hover:underline text-sm font-bold">Mulai Belanja</button>
        </div>`;
      totalEl.innerText = "Rp 0";
      return;
  }
  
  container.innerHTML = cart.map(item => {
    total += (item.price * item.quantity);
    return `
      <div class="flex gap-4 bg-white p-3 rounded-xl border border-gray-100 shadow-sm transition hover:shadow-md">
        <div class="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
            <img src="${item.image}" class="w-full h-full object-cover" onerror="this.src='https://via.placeholder.com/100'">
        </div>
        <div class="flex-grow flex flex-col justify-between">
            <div>
                <h4 class="font-bold text-sm text-lumina-dark line-clamp-1">${item.name}</h4>
                <p class="text-xs text-lumina-gold font-bold">Rp ${item.price.toLocaleString('id-ID')}</p>
            </div>
            
            <div class="flex items-center justify-between mt-2">
                <div class="flex items-center gap-2 bg-gray-50 rounded-lg p-1">
                    <button onclick="updateQty('${item.id}', -1)" class="w-6 h-6 bg-white rounded shadow-sm text-xs hover:bg-gray-100 flex items-center justify-center font-bold">-</button>
                    <span class="text-xs font-bold text-gray-700 w-4 text-center">${item.quantity}</span>
                    <button onclick="updateQty('${item.id}', 1)" class="w-6 h-6 bg-white rounded shadow-sm text-xs hover:bg-gray-100 flex items-center justify-center font-bold">+</button>
                </div>
                
                <button onclick="removeFromCart('${item.id}')" class="text-gray-400 hover:text-red-500 transition px-2">
                    <i class="fas fa-trash-alt text-sm"></i>
                </button>
            </div>
        </div>
      </div>`;
  }).join('');

  totalEl.innerText = `Rp ${total.toLocaleString('id-ID')}`;
};

window.toggleCartModal = () => {
  const modal = document.getElementById("cart-modal");
  if (modal.classList.contains("hidden")) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    renderCart();
  } else {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
};

window.checkoutWhatsApp = () => {
    if (!cart.length) return alert("Keranjang masih kosong!");
    
    const form = document.getElementById("checkout-form");
    if (form.classList.contains("hidden")) {
        form.classList.remove("hidden");
        form.scrollIntoView({ behavior: 'smooth' });
        showToast("Silakan isi data pengiriman dulu ya!");
        return;
    }

    const name = document.getElementById("cust-name").value;
    const address = document.getElementById("cust-address").value;

    if (!name || !address) {
        showToast("Nama dan Alamat harus diisi!", "error");
        return;
    }

    let msg = `*PESANAN BARU - LUMINA*\n`;
    msg += `--------------------------\n`;
    msg += ` *Nama:* ${name}\n`;
    msg += ` *Alamat:* ${address}\n`;
    msg += `--------------------------\n`;
    
    let total = 0;
    cart.forEach(i => {
        msg += `• ${i.name} (${i.quantity}x) - Rp ${(i.price * i.quantity).toLocaleString()}\n`;
        total += (i.price * i.quantity);
    });
    
    msg += `--------------------------\n`;
    msg += `*Total: Rp ${total.toLocaleString('id-ID')}*`;

    // GANTI NOMOR DI SINI (Format: 628...)
    const waNumber = "6281210680152"; 
    window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`);

    // Simpan data user biar gak ngetik ulang
    localStorage.setItem("cust_name_saved", name);
    localStorage.setItem("cust_address_saved", address);
};

// ============================================================
// 8. NAVIGASI, FILTER & UTILS
// ============================================================
window.filterCategory = (cat) => {
    currentCategory = cat;
    const titleEl = document.getElementById("katalog-title");
    if(titleEl) titleEl.innerText = cat === "Semua" ? "Koleksi Terbaru" : "Koleksi " + cat;
    
    const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?category=' + encodeURIComponent(cat);
    window.history.pushState({ path: newUrl }, '', newUrl);

    document.querySelectorAll(".category-btn").forEach(btn => {
        const active = btn.innerText.trim() === cat;
        btn.className = active 
            ? "category-btn px-6 py-2 rounded-full border border-lumina-dark bg-lumina-dark text-white font-medium shadow-md text-sm transition" 
            : "category-btn px-6 py-2 rounded-full border border-gray-300 text-gray-500 font-medium hover:border-lumina-dark hover:text-lumina-dark transition text-sm";
    });
    
    renderProducts(true); 
};

window.handleSearch = (e) => { 
    searchQuery = e.target.value; 
    renderProducts(false); 
};

window.showToast = (msg, type = "success") => {
  const toast = document.createElement("div");
  const isError = type === "error";
  toast.className = `fixed bottom-5 left-1/2 -translate-x-1/2 bg-white px-6 py-3 rounded-full shadow-2xl border border-gray-100 flex items-center gap-3 z-[150] transition-all duration-500 transform translate-y-20 opacity-0`;
  
  toast.innerHTML = `
    <i class="fas ${isError ? 'fa-exclamation-circle text-red-500' : 'fa-check-circle text-green-500'}"></i> 
    <span class="text-sm font-bold text-lumina-dark">${msg}</span>
  `;
  
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove("translate-y-20", "opacity-0");
  });

  setTimeout(() => {
    toast.classList.add("translate-y-20", "opacity-0");
    setTimeout(() => toast.remove(), 500);
  }, 3000);
};

// ============================================================
// 9. ADMIN & LOGIN
// ============================================================
window.checkLogin = () => {
  const passwordInput = document.getElementById("admin-password");
  if (passwordInput.value === "admin123") {
    showToast("Akses Diterima! Mengalihkan...");
    setTimeout(() => { window.location.href = "index.html"; }, 1000);
  } else {
    showToast("Sandi salah!", "error");
    passwordInput.value = "";
    passwordInput.focus();
  }
};

window.openLoginModal = () => {
  const modal = document.getElementById("login-modal");
  if(modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    setTimeout(() => document.getElementById("admin-password").focus(), 100);
  }
};

window.closeLoginModal = () => {
  const modal = document.getElementById("login-modal");
  if(modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
};

// ============================================================
// 10. EVENT LISTENERS & STARTUP
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const categoryFromUrl = urlParams.get('category');
    if (categoryFromUrl) {
        filterCategory(categoryFromUrl);
    }
    document.getElementById("cust-name").value = localStorage.getItem("cust_name_saved") || "";
    document.getElementById("cust-address").value = localStorage.getItem("cust_address_saved") || "";
});

window.onpopstate = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const categoryFromUrl = urlParams.get('category') || "Semua";
    filterCategory(categoryFromUrl);
};