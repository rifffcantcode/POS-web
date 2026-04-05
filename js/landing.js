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
const categoriesRef = collection(db, "categories");

// 2. Fungsi untuk mengambil dan merender kategori
const categoryContainer = document.getElementById("category-container");
const categoryFiltersContainer = document.getElementById("landing-category-filters");

if (categoryContainer) {
    onSnapshot(categoriesRef, (snapshot) => {
        categoryContainer.innerHTML = ""; // Bersihkan card
        
        // 1. Ambil data dan FILTER kategori yang tidak dihapus (isDeleted !== true)
        const activeCategories = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(cat => cat.isDeleted !== true);

        // Siapkan tombol "Semua" sebagai default
        let buttonsHTML = `
            <button
                onclick="filterCategory('Semua')"
                class="category-btn px-6 py-2 rounded-full border border-lumina-dark bg-lumina-dark text-white font-medium shadow-md text-sm transition whitespace-nowrap"
            >
                Semua
            </button>
        `;
        
        // 2. Jika tidak ada kategori aktif (setelah difilter)
        if (activeCategories.length === 0) {
            categoryContainer.innerHTML = `
                <div class="col-span-1 md:col-span-3 text-center py-10 text-gray-400">
                    <i class="fas fa-folder-open text-4xl mb-3 opacity-50"></i>
                    <p>Belum ada kategori yang tersedia.</p>
                </div>`;
            if (categoryFiltersContainer) categoryFiltersContainer.innerHTML = buttonsHTML;
            return;
        }

        // 3. Looping dari hasil filter (activeCategories)
        activeCategories.forEach((cat) => {
            
            // Inject HTML untuk Card Kategori
            categoryContainer.innerHTML += `
                <div
                  class="group relative overflow-hidden rounded-3xl bg-gray-200 cursor-pointer shadow-xl snap-start"
                  style="flex: 0 0 auto; width: 85vw; max-width: 350px; height: 400px;"
                  onclick="
                    filterCategory('${cat.name}');
                    const grid = document.getElementById('customer-product-grid');
                    if(grid) {
                        window.scrollTo({
                            top: grid.offsetTop - 100,
                            behavior: 'smooth',
                        });
                    }
                  "
                >
                  <img
                    src="${cat.image || 'https://via.placeholder.com/400'}"
                    alt="${cat.name}"
                    class="w-full h-full object-cover transition duration-500 group-hover:scale-110 opacity-90"
                  />
                  <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-8 text-white">
                    <h4 class="text-2xl font-bold mb-2">${cat.name}</h4>
                    <p class="text-sm opacity-80 mb-4">${cat.description || ''}</p>
                    <span class="bg-lumina-gold text-lumina-dark py-2 px-6 rounded-full font-bold text-xs w-fit">
                        Lihat Koleksi
                    </span>
                  </div>
                </div>
            `;

            // Tambahkan HTML untuk Tombol Filter Kategori
            buttonsHTML += `
                <button
                    onclick="filterCategory('${cat.name}')"
                    class="category-btn px-6 py-2 rounded-full border border-gray-300 text-gray-500 font-medium hover:border-lumina-dark hover:text-lumina-dark transition text-sm whitespace-nowrap"
                >
                    ${cat.name}
                </button>
            `;
        });

        // Masukkan kumpulan tombol ke container
        if (categoryFiltersContainer) {
            categoryFiltersContainer.innerHTML = buttonsHTML;
        }

    }, (error) => {
        console.error("Gagal mengambil data kategori dari Firebase:", error);
    });
}

// --- STATE MANAGEMENT ---
let allProducts = [];
let cart = [];
let currentCategory = "Semua";
let searchQuery = "";

// ============================================================
// 1. INITIAL LOAD & FIX GHOST ITEM
// ============================================================
try {
  const savedCart = localStorage.getItem("lumina_cart");
  if (savedCart) {
    const parsed = JSON.parse(savedCart);
    cart = parsed
      .filter(item => item.id && item.name) 
      .map(item => ({
        ...item,
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 1
      }));
    localStorage.setItem("lumina_cart", JSON.stringify(cart));
  }
} catch (e) { 
  console.error("Data keranjang corrupt, reset total.", e);
  cart = []; 
  localStorage.removeItem("lumina_cart");
}

// ============================================================
// 2. SKELETON LOADING
// ============================================================
window.showSkeleton = () => {
  const grid = document.getElementById("customer-product-grid");
  if (!grid) return;
  
  grid.innerHTML = "";
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

window.showSkeleton();

// ============================================================
// 3. REAL-TIME DATABASE (SINGLE LISTENER)
// ============================================================
onSnapshot(collection(db, "products"), (snapshot) => {
  allProducts = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    
    if (data.isDeleted !== true) { 
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
    const delay = i * 0.1; 
    
    grid.innerHTML += `
    <div class="glass-card reveal-card rounded-2xl overflow-hidden flex flex-col group relative shadow-sm bg-white" 
          style="animation-delay: ${delay}s">
        <div onclick="openProductDetail('${p.id}')" 
              class="product-image-container w-full h-64 p-6 cursor-pointer bg-gray-50 relative overflow-hidden">
            <img src="${p.image}" class="object-contain w-full h-full mix-blend-multiply group-hover:scale-110 transition-transform duration-700" onerror="this.src='https://via.placeholder.com/300?text=No+Image'">
            ${availableStock <= 0 ? '<div class="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center text-white font-bold text-xs uppercase tracking-widest z-10">Stok Habis</div>' : ''}
            <div class="absolute top-3 left-3 z-10">
                <span class="text-[9px] font-bold text-lumina-dark bg-white/90 backdrop-blur-md px-2 py-1 rounded-full uppercase tracking-tighter border border-white/50 shadow-sm">${p.category}</span>
            </div>
        </div>
        <div class="p-5 flex-grow flex flex-col"> 
            <h4 onclick="openProductDetail('${p.id}')" class="text-md font-bold text-lumina-dark mb-1 hover:text-lumina-gold cursor-pointer line-clamp-2 transition-colors">${p.name}</h4>
            <div class="mt-auto flex items-center justify-between pt-4 border-t border-gray-100 mt-4">
                <div>
                    <p class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Price</p>
                    <p class="text-lg font-black text-lumina-gold">Rp ${p.price.toLocaleString('id-ID')}</p>
                </div>
                <button onclick="addToCartCustomer('${p.id}', event)" ${availableStock <= 0 ? 'disabled' : ''} 
                    class="${availableStock > 0 ? 'bg-lumina-dark text-white hover:bg-black shadow-lg' : 'bg-gray-200 text-gray-400 cursor-not-allowed'} w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-95">
                    <i class="fas fa-plus"></i>
                </button>
            </div>
        </div>
    </div>`;
  });
};

// Fungsi baru untuk menggeser kategori dengan panah
window.scrollLandingCategories = (distance) => {
    const container = document.getElementById('landing-category-filters');
    if (container) {
        container.scrollBy({
            left: distance,
            behavior: 'smooth'
        });
    }
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
      <div class="bg-gray-50 rounded-2xl p-8 flex items-center justify-center"><img src="${product.image}" class="max-h-80 object-contain mix-blend-multiply" onerror="this.src='https://via.placeholder.com/300'"></div>
      <div class="flex flex-col">
        <span class="text-xs font-bold text-lumina-gold uppercase tracking-widest">${product.category}</span>
        <h2 class="text-3xl font-bold text-lumina-dark mt-2 mb-4">${product.name}</h2>
        <p class="text-2xl font-bold text-lumina-dark mb-6">Rp ${product.price.toLocaleString('id-ID')}</p>
        <div class="border-t border-b py-6 mb-6">
          <h5 class="text-sm font-bold text-gray-400 uppercase mb-2">Deskripsi Produk</h5>
          <p class="text-gray-600 leading-relaxed text-sm">${product.description || 'Tidak ada deskripsi untuk produk ini.'}</p>
        </div>
        <div class="mt-auto flex gap-4">
          <button onclick="addToCartCustomer('${product.id}', event)" ${availableStock <= 0 ? 'disabled' : ''} class="flex-grow ${availableStock > 0 ? 'bg-lumina-dark hover:bg-black' : 'bg-gray-300 cursor-not-allowed'} text-white py-4 rounded-xl font-bold transition flex items-center justify-center gap-2">
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

    if (currentQty >= product.stock) {
        showToast("Maaf, jumlah pesanan sudah mencapai batas stok!", "error");
        return;
    }

    if (event) {
        try {
            const btn = event.currentTarget;
            const rect = btn.getBoundingClientRect();
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
        } catch(err) { console.log("Animation skipped"); }
    }

    if (itemInCart) { itemInCart.quantity += 1; } 
    else { cart.push({ ...product, quantity: 1 }); }
    
    saveAndRefresh(false); 
    showToast(`${product.name} berhasil ditambahkan!`);
};

window.updateQty = (id, change) => {
    const item = cart.find(p => p.id === id);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) { window.removeFromCart(id); } 
        else {
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
    cart = cart.filter(item => item.id !== id);
    saveAndRefresh(true); 
};

window.saveAndRefresh = (animate = true) => {
    localStorage.setItem('lumina_cart', JSON.stringify(cart));
    updateCartCount();
    renderProducts(false); 
    const cartModal = document.getElementById("cart-modal");
    if (cartModal && !cartModal.classList.contains("hidden")) { renderCart(); }
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
        <div class="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0"><img src="${item.image}" class="w-full h-full object-cover" onerror="this.src='https://via.placeholder.com/100'"></div>
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
                <button onclick="removeFromCart('${item.id}')" class="text-gray-400 hover:text-red-500 transition px-2"><i class="fas fa-trash-alt text-sm"></i></button>
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
    if (!name || !address) { showToast("Nama dan Alamat harus diisi!", "error"); return; }

    let msg = `*PESANAN BARU - LUMINA*\n--------------------------\n *Nama:* ${name}\n *Alamat:* ${address}\n--------------------------\n`;
    let total = 0;
    cart.forEach(i => {
        msg += `• ${i.name} (${i.quantity}x) - Rp ${(i.price * i.quantity).toLocaleString()}\n`;
        total += (i.price * i.quantity);
    });
    msg += `--------------------------\n*Total: Rp ${total.toLocaleString('id-ID')}*`;
    const waNumber = "6281210680152"; 
    window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`);
    localStorage.setItem("cust_name_saved", name);
    localStorage.setItem("cust_address_saved", address);
};

// ============================================================
// 8. NAVIGASI, FILTER & UTILS
// ============================================================
// Fungsi untuk merubah warna tombol dan memfilter produk
window.filterCategory = (cat) => {
    currentCategory = cat;
    
    const container = document.getElementById("landing-category-filters");
    if (container) {
        Array.from(container.children).forEach(btn => {
            if (btn.innerText.trim() === cat) {
                // Style saat aktif (Hitam)
                btn.className = "category-btn px-6 py-2 rounded-full border border-lumina-dark bg-lumina-dark text-white font-medium shadow-md text-sm transition whitespace-nowrap";
            } else {
                // Style saat tidak aktif (Putih/Abu)
                btn.className = "category-btn px-6 py-2 rounded-full border border-gray-300 text-gray-500 font-medium hover:border-lumina-dark hover:text-lumina-dark transition text-sm whitespace-nowrap";
            }
        });
    }

    renderProducts();
};

window.handleSearch = (e) => { searchQuery = e.target.value; renderProducts(false); };

window.showToast = (msg, type = "success") => {
  const toast = document.createElement("div");
  const isError = type === "error";
  
  // PERBAIKAN: z-[150] diubah ke z-[300] agar di atas modal (z-200)
  // Tambahkan juga 'pointer-events-none' agar tidak menghalangi klik saat transisi
  toast.className = `fixed bottom-10 left-1/2 -translate-x-1/2 bg-white px-8 py-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-gray-100 flex items-center gap-4 z-[300] transition-all duration-500 transform translate-y-20 opacity-0`;
  
  toast.innerHTML = `
    <div class="flex items-center justify-center w-8 h-8 rounded-full ${isError ? 'bg-red-50' : 'bg-green-50'}">
        <i class="fas ${isError ? 'fa-exclamation-circle text-red-500' : 'fa-check-circle text-green-500'} text-lg"></i>
    </div>
    <div class="flex flex-col">
        <span class="text-xs text-gray-400 font-medium uppercase tracking-wider">${isError ? 'System Error' : 'Success'}</span>
        <span class="text-sm font-bold text-lumina-dark">${msg}</span>
    </div>
  `;

  document.body.appendChild(toast);

  // Trigger Animasi Masuk
  requestAnimationFrame(() => { 
    toast.classList.remove("translate-y-20", "opacity-0"); 
  });

  // Hapus toast setelah 3 detik
  setTimeout(() => {
    toast.classList.add("translate-y-20", "opacity-0");
    setTimeout(() => toast.remove(), 500);
  }, 3000);
};

// ============================================================
// 9. MODIFIKASI: SISTEM LOGIN TERBARU (DUAL ACCESS)
// ============================================================

// Fungsi Handle Auth (Menggantikan checkLogin lama)
window.handleAuthLogin = (e) => {
    e.preventDefault();

    const email = document.getElementById("login-email").value.trim().toLowerCase();
    const password = document.getElementById("login-password").value.trim();

    const btn = e.target.querySelector('button');
    const originalText = btn.innerHTML;

    // Data user (sementara hardcode dulu)
    const users = [
        {
            email: "kasirlumina@gmail.com",
            password: "kasir123",
            role: "kasir",
            redirect: "index.html"
        },
        {
            email: "adminlumina@gmail.com",
            password: "admin123",
            role: "admin",
            redirect: "laporan.html"
        }
    ];

    // Cari user yang cocok
    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
        showToast(`Akses Diterima! Selamat Datang, ${user.role}`, "success");

        btn.innerHTML = "Masuk...";
        btn.disabled = true;

        setTimeout(() => {
            window.location.href = user.redirect;
        }, 1500);

    } else {
        showToast("Email atau password salah!", "error");
    }
};

window.openLoginModal = () => {
  const modal = document.getElementById("login-modal");
  if(modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    
    // Focus ke input email saat terbuka agar user bisa langsung mengetik
    setTimeout(() => {
        const input = document.getElementById("login-email");
        if(input) input.focus();
    }, 200);
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
// DRAG TO SCROLL (CATEGORY CONTAINER)
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    const slider = document.getElementById('category-container');
    let isDown = false;
    let startX;
    let scrollLeft;

    if (!slider) return;

    slider.addEventListener('mousedown', (e) => {
        isDown = true;
        slider.classList.add('active'); // Opsional: untuk mengubah kursor
        slider.style.cursor = 'grabbing';
        // Menyimpan posisi awal klik
        startX = e.pageX - slider.offsetLeft;
        scrollLeft = slider.scrollLeft;
    });

    slider.addEventListener('mouseleave', () => {
        isDown = false;
        slider.classList.remove('active');
        slider.style.cursor = 'grab';
    });

    slider.addEventListener('mouseup', () => {
        isDown = false;
        slider.classList.remove('active');
        slider.style.cursor = 'grab';
    });

    slider.addEventListener('mousemove', (e) => {
        if (!isDown) return; // Jika tidak sedang diklik, abaikan
        e.preventDefault(); // Mencegah highlight teks/gambar bawaan browser
        
        const x = e.pageX - slider.offsetLeft;
        const walk = (x - startX) * 2; // Angka 2 adalah kecepatan scroll
        slider.scrollLeft = scrollLeft - walk;
    });

    // Set kursor default saat dilewati mouse
    slider.addEventListener('mouseenter', () => {
        if(!isDown) slider.style.cursor = 'grab';
    });
});

// ============================================================
// 10. EVENT LISTENERS & STARTUP
// ============================================================
// 2. FUNGSI RENDER KATEGORI (Taruh di bagian bawah landing.js)

window.onpopstate = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const categoryFromUrl = urlParams.get('category') || "Semua";
    filterCategory(categoryFromUrl);
};