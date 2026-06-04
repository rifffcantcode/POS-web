import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, query, orderBy, onSnapshot, doc, updateDoc, getDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { showPopup } from "./notify.js";

const firebaseConfig = {
    apiKey: "AIzaSyBMsUhXj-UCLLviXzweS1qXVdSaVgkDcu8",
    authDomain: "sistemkasirtokocom.firebaseapp.com",
    projectId: "sistemkasirtokocom",
    storageBucket: "sistemkasirtokocom.firebasestorage.app",
    messagingSenderId: "141722200955",
    appId: "1:141722200955:web:e07952808590aa7f582bde"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let salesChart;
let topProductsChart;
let isFirstLoad = true;
let unsubscribeSnapshot;
let unsubscribeUsersSnapshot;
const TOP_PRODUCTS_COLORS = ['#D4AF37', '#1D2939', '#475569', '#94A3B8', '#CBD5E1'];
const REPORT_PAGE_SIZE = 8;
let reportTransactions = [];
let currentReportPage = 1;
const ROLE_OPTIONS = ["customer", "kasir", "admin"];
let reportPageInitialized = false;

function playDonutSpinAnimation(canvas, firstLoad = false) {
    if (!canvas || typeof canvas.animate !== "function") return;

    const duration = firstLoad ? 1600 : 900;
    canvas.animate(
        [
            { transform: 'rotate(-360deg) scale(0.86)', opacity: 0.25 },
            { transform: 'rotate(0deg) scale(1)', opacity: 1 }
        ],
        {
            duration,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            fill: 'both'
        }
    );
}

function renderTopProductsLegend(labels = [], colors = []) {
    const legendEl = document.getElementById('top-products-legend');
    if (!legendEl) return;

    if (!labels.length) {
        legendEl.innerHTML = '';
        return;
    }

    legendEl.innerHTML = labels.map((label, i) => `
        <div class="flex items-center gap-1.5">
            <span class="inline-block w-2.5 h-2.5 rounded-full" style="background:${colors[i] || '#CBD5E1'};"></span>
            <span>${label}</span>
        </div>
    `).join('');
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function roleBadgeClass(role) {
    const normalized = (role || "").toLowerCase();
    if (normalized === "admin") return "bg-purple-100 text-purple-700";
    if (normalized === "kasir") return "bg-blue-100 text-blue-700";
    return "bg-slate-100 text-slate-700";
}

function getRoleSelectHtml(uid, currentRole) {
    const normalizedRole = (currentRole || "customer").toLowerCase();
    const options = ROLE_OPTIONS.map((role) => `
        <option value="${role}" ${normalizedRole === role ? "selected" : ""}>
            ${role.toUpperCase()}
        </option>
    `).join("");

    return `
        <select
            id="role-select-${uid}"
            class="w-[130px] bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded-lg text-xs font-bold focus:ring-2 focus:ring-lumina-gold outline-none"
        >
            ${options}
        </select>
    `;
}

function renderRoleUsersTable(users) {
    const tbody = document.getElementById("role-user-table-body");
    if (!tbody) return;

    if (!users.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-8 py-10 text-center text-slate-400 text-sm font-medium">
                    Belum ada data user pada koleksi users.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = users.map((user) => {
        const role = (user.role || "customer").toLowerCase();
        const displayName = escapeHtml(user.fullName || user.displayName || "-");
        const email = escapeHtml(user.email || "-");

        return `
            <tr class="hover:bg-slate-50 border-b border-slate-50">
                <td class="px-8 py-5 font-semibold text-slate-700">${displayName}</td>
                <td class="px-8 py-5 text-xs text-slate-500">${email}</td>
                <td class="px-8 py-5">
                    <span class="text-[10px] font-bold px-3 py-1 rounded-full uppercase ${roleBadgeClass(role)}">
                        ${role}
                    </span>
                </td>
                <td class="px-8 py-5">
                    ${getRoleSelectHtml(user.id, role)}
                </td>
                <td class="px-8 py-5 text-right flex items-center gap-2 justify-end">
                    <button
                        onclick="updateUserRole('${user.id}')"
                        class="bg-lumina-dark text-lumina-gold px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#243447] transition"
                    >
                        Simpan
                    </button>
                    <button
                        onclick="deleteUserAccount('${user.id}', '${escapeHtml(displayName)}')"
                        class="bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-700 transition"
                    >
                        Hapus
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

function initUsersRoleManager() {
    if (unsubscribeUsersSnapshot) unsubscribeUsersSnapshot();

    const usersRef = collection(db, "users");
    unsubscribeUsersSnapshot = onSnapshot(usersRef, (snapshot) => {
        const users = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data()
        }));

        users.sort((a, b) => {
            const aName = (a.fullName || a.displayName || a.email || "").toLowerCase();
            const bName = (b.fullName || b.displayName || b.email || "").toLowerCase();
            return aName.localeCompare(bName);
        });

        renderRoleUsersTable(users);
    }, (error) => {
        console.error("Gagal memuat data users:", error);
        const tbody = document.getElementById("role-user-table-body");
        if (!tbody) return;
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-8 py-10 text-center text-red-500 text-sm font-medium">
                    Gagal memuat data users.
                </td>
            </tr>
        `;
    });
}

window.updateUserRole = async function(userId) {
    const selectEl = document.getElementById(`role-select-${userId}`);
    if (!selectEl) return;

    const newRole = (selectEl.value || "").toLowerCase();
    if (!ROLE_OPTIONS.includes(newRole)) {
        showPopup("Role tidak valid.", "error");
        return;
    }

    try {
        await updateDoc(doc(db, "users", userId), {
            role: newRole,
            updatedAt: new Date().toISOString()
        });
        showPopup(`Role berhasil diubah ke ${newRole.toUpperCase()}.`, "success");
    } catch (error) {
        console.error("Gagal update role user:", error);
        showPopup("Gagal mengubah role user.", "error");
    }
};

window.deleteUserAccount = async function(userId, userName) {
    const confirmed = confirm(`Apakah Anda yakin ingin menghapus akun "${userName}"? Tindakan ini tidak dapat dibatalkan.`);
    
    if (!confirmed) return;

    try {
        const btn = event.target;
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        btn.disabled = true;

        await deleteDoc(doc(db, "users", userId));
        
        showPopup(`Akun "${userName}" berhasil dihapus.`, "success");
    } catch (error) {
        console.error("Gagal menghapus akun user:", error);
        showPopup("Gagal menghapus akun user.", "error");
        
        if (event && event.target) {
            event.target.innerHTML = '<i class="fas fa-trash text-sm"></i> Hapus';
            event.target.disabled = false;
        }
    }
};

function renderReportTablePage() {
    const tbody = document.getElementById("report-table-body");
    const paginationEl = document.getElementById("report-pagination");
    if (!tbody) return;

    if (!Array.isArray(reportTransactions) || reportTransactions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-8 py-10 text-center text-slate-400 text-sm font-medium">
                    Belum ada transaksi sukses pada periode ini.
                </td>
            </tr>
        `;
        if (paginationEl) paginationEl.innerHTML = "";
        return;
    }

    const totalPages = Math.max(1, Math.ceil(reportTransactions.length / REPORT_PAGE_SIZE));
    currentReportPage = Math.min(Math.max(currentReportPage, 1), totalPages);

    const start = (currentReportPage - 1) * REPORT_PAGE_SIZE;
    const end = start + REPORT_PAGE_SIZE;
    const pageItems = reportTransactions.slice(start, end);

    tbody.innerHTML = pageItems.map((row, i) => `
        <tr class="hover:bg-slate-50 border-b border-slate-50 cursor-pointer" onclick="openTransactionDetail(${start + i})">
            <td class="px-8 py-5 font-semibold">${row.timeLabel}</td>
            <td class="px-8 py-5 font-mono text-[11px]">${row.orderId}</td>
            <td class="px-8 py-5 text-xs text-slate-500">${row.itemsText}</td>
            <td class="px-8 py-5 text-sm font-medium text-slate-700">${row.customerName}</td>
            <td class="px-8 py-5 text-xs">
                <span class="px-2 py-1 rounded-full text-[10px] font-bold uppercase ${row.paymentMethod === 'cash' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}">
                    ${row.paymentMethod}
                </span>
            </td>
            <td class="px-8 py-5 text-sm text-slate-500">${row.paymentMethod === 'cash' ? 'Rp ' + row.change.toLocaleString('id-ID') : '-'}</td>
            <td class="px-8 py-5 text-right font-black">Rp ${row.total.toLocaleString('id-ID')}</td>
        </tr>
    `).join("");

    if (!paginationEl) return;
    if (totalPages <= 1) {
        paginationEl.innerHTML = "";
        return;
    }

    const pageButtons = Array.from({ length: totalPages }, (_, i) => {
        const page = i + 1;
        const active = page === currentReportPage;
        return `
            <button onclick="changeReportPage(${page})"
                class="w-9 h-9 rounded-lg text-xs font-bold border transition ${active ? "bg-lumina-dark text-lumina-gold border-lumina-dark" : "bg-white text-slate-600 border-slate-200 hover:border-lumina-dark hover:text-lumina-dark"}">
                ${page}
            </button>
        `;
    }).join("");

    paginationEl.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-3">
            <p class="text-xs text-slate-400 font-medium">
                Menampilkan ${start + 1}-${Math.min(end, reportTransactions.length)} dari ${reportTransactions.length} transaksi
            </p>
            <div class="flex items-center gap-2">
                <button onclick="changeReportPage(${currentReportPage - 1})"
                    class="h-9 px-3 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-600 hover:border-lumina-dark hover:text-lumina-dark transition ${currentReportPage === 1 ? "opacity-50 pointer-events-none" : ""}">
                    Prev
                </button>
                ${pageButtons}
                <button onclick="changeReportPage(${currentReportPage + 1})"
                    class="h-9 px-3 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-600 hover:border-lumina-dark hover:text-lumina-dark transition ${currentReportPage === totalPages ? "opacity-50 pointer-events-none" : ""}">
                    Next
                </button>
            </div>
        </div>
    `;
}

window.changeReportPage = function(page) {
    currentReportPage = page;
    renderReportTablePage();
};

// =======================
// CHART LINE (EMPTY STATE)
// =======================
function initChart(data, isEmpty = false) {
    const canvas = document.getElementById('salesChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (salesChart) salesChart.destroy();

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(212, 175, 55, 0.3)');
    gradient.addColorStop(1, 'rgba(212, 175, 55, 0)');

    salesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: isEmpty ? ["-"] : data.labels,
            datasets: [{
                label: 'Penjualan',
                data: isEmpty ? [0] : data.values,
                borderColor: '#D4AF37',
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointRadius: isEmpty ? 0 : 4,
                pointBackgroundColor: '#D4AF37'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    top: 15,
                    right: 15,
                    bottom: 25,
                    left: 15
                }
            },
            animations: {
                y: {
                    duration: isFirstLoad ? 2000 : 800,
                    easing: 'easeOutQuart',
                    from: (ctx) => ctx.chart.scales.y.getPixelForValue(0)
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: { enabled: !isEmpty }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        display: !isEmpty,
                        callback: (v) => 'Rp ' + v.toLocaleString('id-ID'),
                        padding: 8
                    },
                    grid: { display: !isEmpty }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        display: !isEmpty,
                        maxRotation: 45,
                        minRotation: 0,
                        maxTicksLimit: 12,
                        padding: 8
                    }
                }
            }
        },
        plugins: [{
            id: 'emptyStateText',
            afterDraw(chart) {
                if (!isEmpty) return;

                const { ctx, chartArea } = chart;
                const centerX = (chartArea.left + chartArea.right) / 2;
                const centerY = (chartArea.top + chartArea.bottom) / 2;

                ctx.save();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                ctx.font = '600 16px sans-serif';
                ctx.fillStyle = '#94A3B8';
                ctx.fillText('Belum ada data', centerX, centerY - 10);

                ctx.font = '400 12px sans-serif';
                ctx.fillStyle = '#CBD5E1';
                ctx.fillText('Data akan muncul setelah transaksi', centerX, centerY + 10);

                ctx.restore();
            }
        }]
    });
}

// =======================
// DONUT CHART
// =======================
function initTopProductsChart(productData) {
    const canvas = document.getElementById('topProductsChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (topProductsChart) topProductsChart.destroy();

    setTimeout(() => {
        topProductsChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: productData.labels,
                datasets: [{
                    data: productData.values,
                    backgroundColor: TOP_PRODUCTS_COLORS.slice(0, productData.labels.length),
                    borderWidth: 0,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                radius: '98%',
                cutout: '73%',
                rotation: -0.5 * Math.PI,
                layout: {
                    padding: { top: 8, right: 10, bottom: 8, left: 10 }
                },
                animation: {
                    duration: 0
                },
                animations: {
                    rotation: {
                        duration: isFirstLoad ? 1700 : 900,
                        easing: 'easeOutQuart',
                        from: -2.5 * Math.PI
                    },
                    scale: {
                        duration: isFirstLoad ? 1200 : 700,
                        easing: 'easeOutBack',
                        from: 0.82,
                        to: 1
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });

        renderTopProductsLegend(
            productData.labels,
            TOP_PRODUCTS_COLORS.slice(0, productData.labels.length)
        );
        playDonutSpinAnimation(canvas, isFirstLoad);
    }, 150);
}

// =======================
// LOAD DATA (FIXED)
// =======================
function loadReport(period = "all") {
    if (unsubscribeSnapshot) unsubscribeSnapshot();

    const q = query(collection(db, "sales"), orderBy("createdAt", "asc"));

    unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        const tbody = document.getElementById("report-table-body");
        const productSales = {};
        const dailyData = {};

        let totalRev = 0, totalOrd = 0, totalItems = 0;

        tbody.innerHTML = "";
        reportTransactions = [];
        currentReportPage = 1;

        const startTime = getStartTime(period);

        snapshot.forEach((doc) => {
            const data = doc.data();

            // FIX: Skip dokumen yang createdAt-nya masih null
            // Ini terjadi saat Firestore belum commit serverTimestamp ke server (pending local write)
            // Tanpa ini, transaksi cash bisa muncul sebentar lalu hilang, atau tidak terbaca dengan benar
            if (!data.createdAt) {
                console.warn(`[ADMIN DEBUG] SKIP doc=${doc.id} — createdAt masih null (pending server write)`);
                return;
            }

            // 1. Fallback timestamp aman dari pending local write
            const ts = data.createdAt.toDate();

            // 2. Hanya memproses transaksi dengan status success ATAU orderType=online dengan total > 0
            // FIX: Online transactions dari landing page boleh ditampilkan meski status=pending 
            // (jika sudah memiliki total dan orderType=online, berarti sudah dibuat dari checkout)
            const isOnlineTransaction = data.orderType === "online" && Number(data.total) > 0;
            const isSuccessTransaction = data.status === "success";
            
            if (!isOnlineTransaction && !isSuccessTransaction) {
                console.warn(`[ADMIN DEBUG] SKIP doc=${doc.id} status="${data.status}" orderType="${data.orderType}" total=${data.total}`);
                return;
            }

            // 3. Filter berdasarkan periode waktu
            if (ts < startTime) return; 

            // DEBUG: log setiap dokumen untuk diagnosa di console browser
            console.log(`[ADMIN DEBUG] doc=${doc.id} | status="${data.status}" | customerName="${data.customerName}" | paymentMethod="${data.paymentMethod}" | ts=${ts}`);

            // 4. Standarisasi nominal total belanja (bisa membaca 'total' atau 'totalAmount')
            const rowTotal = Number(data.totalAmount) || Number(data.total) || 0;

            totalRev += rowTotal;
            totalOrd++;

            const dateLabel = ts.toLocaleDateString("id-ID", {
                day: 'numeric',
                month: 'short'
            });

            dailyData[dateLabel] = (dailyData[dateLabel] || 0) + rowTotal;

            // Guard: pastikan items adalah array yang valid
            const items = Array.isArray(data.items) ? data.items : [];

            items.forEach(i => {
                // FIX: Antisipasi jika di database menggunakan properti .qty atau .quantity
                const itemQty = Number(i.quantity) || Number(i.qty) || 0;
                
                totalItems += itemQty;
                if (i.name) {
                    productSales[i.name] = (productSales[i.name] || 0) + itemQty;
                }
            });

            // FIX: Teks deskripsi item di tabel riwayat
            const itemsText = items.map(i => `${i.name} (x${Number(i.quantity) || Number(i.qty) || 0})`).join(", ") || "-";

            reportTransactions.push({
                timestamp: ts.getTime(),
                timeLabel: ts.toLocaleString('id-ID'),
                orderId: data.orderId || "-",
                itemsText,
                customerName: data.customerName || "-",
                paymentMethod: data.paymentMethod || "-",
                change: Number(data.change) || 0,
                total: rowTotal,
                orderType: data.orderType || "offline",
                shippingAddress: data.shippingAddress || null,
                shippingPhone: data.shippingPhone || null,
            });
        });

        reportTransactions.sort((a, b) => b.timestamp - a.timestamp);
        renderReportTablePage();

        // SUMMARY
        document.getElementById("total-revenue").innerText = `Rp ${totalRev.toLocaleString('id-ID')}`;
        document.getElementById("total-orders").innerText = totalOrd;
        document.getElementById("total-items").innerText = totalItems;

        // ===================
        // CHART LINE
        // ===================
        const labels = Object.keys(dailyData);
        if (labels.length > 0) {
            initChart({ labels, values: Object.values(dailyData) });
        } else {
            initChart({}, true); // empty state
        }

        // ===================
        // DONUT
        // ===================
        const sorted = Object.entries(productSales)
            .sort((a,b) => b[1] - a[1])
            .slice(0, 5);

        if (sorted.length > 0) {
            initTopProductsChart({
                labels: sorted.map(p => p[0]),
                values: sorted.map(p => p[1])
            });
        } else {
            if (topProductsChart) {
                topProductsChart.destroy();
                topProductsChart = null;
            }
            renderTopProductsLegend([], []);
        }

        if (isFirstLoad) {
            setTimeout(() => { isFirstLoad = false; }, 2000);
        }
    });
} 
// =======================
// FILTER WAKTU
// =======================
function getStartTime(period) {
    const now = new Date();

    if (period === "today") {
        return new Date(now.setHours(0,0,0,0));
    }

    if (period === "week") {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d;
    }

    if (period === "month") {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d;
    }

    return new Date(0);
}

// =======================
// EXPORT PDF (PROPER REPORT)
// =======================
document.getElementById("export-pdf-btn").addEventListener("click", async () => {
    const btn = document.getElementById("export-pdf-btn");
    try {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Membuat PDF...';
        btn.disabled = true;

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF("p", "mm", "a4");

        // ── Konstanta layout ──
        const PAGE_W = 210;
        const PAGE_H = 297;
        const MARGIN = 14;
        const CONTENT_W = PAGE_W - MARGIN * 2;
        const GOLD = [212, 175, 55];
        const DARK = [29, 41, 57];
        const SLATE = [71, 85, 105];
        const LIGHT = [241, 245, 249];
        const WHITE = [255, 255, 255];

        // ── Ambil data ringkasan dari DOM ──
        const totalRevenue = document.getElementById("total-revenue")?.innerText || "Rp 0";
        const totalOrders  = document.getElementById("total-orders")?.innerText  || "0";
        const totalItems   = document.getElementById("total-items")?.innerText   || "0";
        const periodLabel  = (() => {
            const sel = document.getElementById("period-filter");
            if (!sel) return "Semua Waktu";
            const map = { today: "Hari Ini", week: "7 Hari Terakhir", month: "30 Hari Terakhir", all: "Semua Waktu" };
            return map[sel.value] || sel.options[sel.selectedIndex]?.text || "Semua Waktu";
        })();
        const printDate = new Date().toLocaleString("id-ID", {
            day: "2-digit", month: "long", year: "numeric",
            hour: "2-digit", minute: "2-digit"
        });

        // ════════════════════════════════
        // HELPER: tambah halaman baru + header
        // ════════════════════════════════
        let currentPage = 1;

        function addPageHeader(isFirstPage = false) {
            if (!isFirstPage) {
                pdf.addPage();
                currentPage++;
            }

            // Background header bar
            pdf.setFillColor(...DARK);
            pdf.rect(0, 0, PAGE_W, isFirstPage ? 42 : 22, "F");

            // Garis emas di bawah header
            pdf.setFillColor(...GOLD);
            pdf.rect(0, isFirstPage ? 42 : 22, PAGE_W, 1.2, "F");

            if (isFirstPage) {
                // Nama toko
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(18);
                pdf.setTextColor(...GOLD);
                pdf.text("LUMINA STORE", MARGIN, 16);

                // Subjudul
                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(9);
                pdf.setTextColor(203, 213, 225);
                pdf.text("Laporan Penjualan", MARGIN, 23);

                // Periode & tanggal cetak (kanan)
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(8);
                pdf.setTextColor(...GOLD);
                pdf.text(`Periode: ${periodLabel}`, PAGE_W - MARGIN, 16, { align: "right" });
                pdf.setFont("helvetica", "normal");
                pdf.setTextColor(203, 213, 225);
                pdf.text(`Dicetak: ${printDate}`, PAGE_W - MARGIN, 22, { align: "right" });

                // Divider info
                pdf.setFont("helvetica", "italic");
                pdf.setFontSize(7.5);
                pdf.setTextColor(148, 163, 184);
                pdf.text("Dokumen ini digenerate otomatis oleh sistem kasir.", MARGIN, 36);
                pdf.text(`Total ${reportTransactions.length} transaksi ditemukan.`, PAGE_W - MARGIN, 36, { align: "right" });
            } else {
                // Header ringkas untuk halaman lanjutan
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(9);
                pdf.setTextColor(...GOLD);
                pdf.text("LUMINA STORE", MARGIN, 14);
                pdf.setFont("helvetica", "normal");
                pdf.setTextColor(203, 213, 225);
                pdf.text(`Laporan Penjualan · ${periodLabel}`, PAGE_W - MARGIN, 14, { align: "right" });
            }
        }

        // ════════════════════════════════
        // HELPER: footer tiap halaman
        // ════════════════════════════════
        function addPageFooter(pageNum, totalPages) {
            pdf.setFillColor(...DARK);
            pdf.rect(0, PAGE_H - 10, PAGE_W, 10, "F");
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(7);
            pdf.setTextColor(148, 163, 184);
            pdf.text("© Lumina Store · Sistem Kasir", MARGIN, PAGE_H - 3.5);
            pdf.text(`Halaman ${pageNum} dari ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 3.5, { align: "right" });
        }

        // ════════════════════════════════
        // HALAMAN 1 – Header + KPI + Tabel
        // ════════════════════════════════
        addPageHeader(true);

        // ── Kartu KPI ──
        let y = 50;
        const kpiData = [
            { label: "Total Pendapatan", value: totalRevenue, icon: "Rp" },
            { label: "Total Transaksi",  value: totalOrders,  icon: "#"  },
            { label: "Item Terjual",     value: totalItems,   icon: "⊡"  },
        ];
        const kpiW = (CONTENT_W - 8) / 3;

        kpiData.forEach((kpi, i) => {
            const kx = MARGIN + i * (kpiW + 4);
            // Card background
            pdf.setFillColor(...LIGHT);
            pdf.roundedRect(kx, y, kpiW, 22, 2, 2, "F");
            // Aksen emas kiri
            pdf.setFillColor(...GOLD);
            pdf.roundedRect(kx, y, 2.5, 22, 1, 1, "F");
            // Label
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(7.5);
            pdf.setTextColor(...SLATE);
            pdf.text(kpi.label, kx + 7, y + 7);
            // Value
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(12);
            pdf.setTextColor(...DARK);
            pdf.text(String(kpi.value), kx + 7, y + 17);
        });

        y += 30;

        // ── Judul tabel ──
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.setTextColor(...DARK);
        pdf.text("Riwayat Transaksi", MARGIN, y);
        y += 5;

        // ── Header kolom tabel ──
        const COL = {
            no:      { x: MARGIN,       w: 8  },
            waktu:   { x: MARGIN + 8,   w: 28 },
            orderId: { x: MARGIN + 36,  w: 30 },
            customer:{ x: MARGIN + 66,  w: 28 },
            items:   { x: MARGIN + 94,  w: 44 },
            metode:  { x: MARGIN + 138, w: 18 },
            total:   { x: MARGIN + 156, w: 26 },
        };

        function drawTableHeader(yPos) {
            pdf.setFillColor(...DARK);
            pdf.rect(MARGIN, yPos, CONTENT_W, 8, "F");
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(7);
            pdf.setTextColor(...GOLD);
            pdf.text("No",       COL.no.x + 1,       yPos + 5.5);
            pdf.text("Waktu",    COL.waktu.x + 1,     yPos + 5.5);
            pdf.text("Order ID", COL.orderId.x + 1,   yPos + 5.5);
            pdf.text("Customer", COL.customer.x + 1,  yPos + 5.5);
            pdf.text("Item",     COL.items.x + 1,     yPos + 5.5);
            pdf.text("Metode",   COL.metode.x + 1,    yPos + 5.5);
            pdf.text("Total",    COL.total.x + COL.total.w - 1, yPos + 5.5, { align: "right" });
        }

        drawTableHeader(y);
        y += 9;

        // ── Baris data ──
        const ROW_H = 10;
        const FOOTER_SAFE = 18; // ruang untuk footer
        const HEADER_NEXT = 30; // y mulai konten setelah header halaman lanjutan

        // Hitung total halaman (estimasi)
        const ROWS_PAGE1 = Math.floor((PAGE_H - FOOTER_SAFE - y) / ROW_H);
        const ROWS_NEXT  = Math.floor((PAGE_H - FOOTER_SAFE - HEADER_NEXT - 13) / ROW_H);
        let totalPages = 1;
        if (reportTransactions.length > ROWS_PAGE1) {
            const remaining = reportTransactions.length - ROWS_PAGE1;
            totalPages += Math.ceil(remaining / ROWS_NEXT);
        }

        // Render semua baris
        reportTransactions.forEach((row, idx) => {
            // Cek apakah perlu halaman baru
            if (y + ROW_H > PAGE_H - FOOTER_SAFE) {
                addPageFooter(currentPage, totalPages);
                addPageHeader(false);
                y = HEADER_NEXT;
                drawTableHeader(y);
                y += 9;
            }

            // Stripe baris
            if (idx % 2 === 0) {
                pdf.setFillColor(248, 250, 252);
                pdf.rect(MARGIN, y - 1, CONTENT_W, ROW_H, "F");
            }

            // Badge metode pembayaran
            const isCash = row.paymentMethod?.toLowerCase() === "cash";
            pdf.setFillColor(...(isCash ? [220, 252, 231] : [219, 234, 254]));
            const badgeX = COL.metode.x + 1;
            const badgeW = COL.metode.w - 2;
            pdf.roundedRect(badgeX, y + 1, badgeW, 6, 1, 1, "F");
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(6);
            pdf.setTextColor(...(isCash ? [21, 128, 61] : [29, 78, 216]));
            pdf.text((row.paymentMethod || "-").toUpperCase(), badgeX + badgeW / 2, y + 5.3, { align: "center" });

            // Teks baris
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(7);
            pdf.setTextColor(...SLATE);

            const rowY = y + 6.5;
            pdf.text(String(idx + 1), COL.no.x + 1, rowY);

            // Waktu (dibagi 2 baris jika perlu)
            const timeShort = row.timeLabel?.replace(/\.\d+$/, "") || "-";
            pdf.text(pdf.splitTextToSize(timeShort, COL.waktu.w - 2)[0] || timeShort, COL.waktu.x + 1, rowY);

            pdf.setFont("courier", "normal");
            pdf.setFontSize(6.5);
            pdf.text(
                pdf.splitTextToSize(row.orderId, COL.orderId.w - 2)[0] || row.orderId,
                COL.orderId.x + 1, rowY
            );

            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(7);
            pdf.text(
                pdf.splitTextToSize(row.customerName || "-", COL.customer.w - 2)[0],
                COL.customer.x + 1, rowY
            );
            pdf.setFontSize(6.5);
            pdf.setTextColor(100, 116, 139);
            pdf.text(
                pdf.splitTextToSize(row.itemsText || "-", COL.items.w - 2)[0],
                COL.items.x + 1, rowY
            );

            // Total (bold, dark, kanan)
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(7.5);
            pdf.setTextColor(...DARK);
            pdf.text(
                `Rp ${row.total.toLocaleString("id-ID")}`,
                COL.total.x + COL.total.w - 1, rowY,
                { align: "right" }
            );

            // Border bawah baris
            pdf.setDrawColor(226, 232, 240);
            pdf.setLineWidth(0.2);
            pdf.line(MARGIN, y + ROW_H - 1, MARGIN + CONTENT_W, y + ROW_H - 1);

            y += ROW_H;
        });

        // ── Grand Total ──
        if (y + 14 > PAGE_H - FOOTER_SAFE) {
            addPageFooter(currentPage, totalPages);
            addPageHeader(false);
            y = HEADER_NEXT;
        }
        y += 3;
        pdf.setFillColor(...DARK);
        pdf.rect(MARGIN, y, CONTENT_W, 10, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.setTextColor(...GOLD);
        pdf.text("TOTAL PENDAPATAN", MARGIN + 4, y + 6.5);
        pdf.text(totalRevenue, MARGIN + CONTENT_W - 2, y + 6.5, { align: "right" });

        // ── Footer semua halaman ──
        addPageFooter(currentPage, totalPages);

        // ── Simpan file ──
        const fileName = `laporan-penjualan-${new Date().toISOString().slice(0,10)}.pdf`;
        pdf.save(fileName);
        showPopup("Laporan PDF berhasil dibuat!", "success");

    } catch (error) {
        console.error("Gagal export PDF:", error);
        showPopup("Gagal membuat laporan PDF.", "error");
    } finally {
        btn.innerHTML = '<i class="fas fa-file-pdf text-sm"></i> Ekspor PDF';
        btn.disabled = false;
    }
});

// =======================
// EVENT FILTER
// =======================
document.getElementById('period-filter').addEventListener('change', (e) => {
    isFirstLoad = true;
    loadReport(e.target.value);
});

function initAdminPage() {
    if (reportPageInitialized) return;
    reportPageInitialized = true;

    loadReport();
    initUsersRoleManager();
}

// =======================
// DETAIL TRANSAKSI MODAL
// =======================
window.openTransactionDetail = function(index) {
    const row = reportTransactions[index];
    if (!row) return;

    const isOnline = row.orderType === "online";

    document.getElementById("modal-order-id").textContent  = row.orderId;
    document.getElementById("modal-time").textContent      = row.timeLabel;
    document.getElementById("modal-customer").textContent  = row.customerName;
    document.getElementById("modal-items").textContent     = row.itemsText;
    document.getElementById("modal-total").textContent     = "Rp " + row.total.toLocaleString("id-ID");
    document.getElementById("modal-change").textContent    = row.paymentMethod === "cash"
        ? "Rp " + row.change.toLocaleString("id-ID") : "-";

    const methodEl = document.getElementById("modal-payment");
    const isCash = row.paymentMethod === "cash";
    methodEl.innerHTML = `
        <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase ${isCash ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}">
            ${row.paymentMethod}
        </span>
    `;

    const typeEl = document.getElementById("modal-order-type");
    typeEl.innerHTML = isOnline
        ? `<span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-purple-100 text-purple-700">Online</span>`
        : `<span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-600">Offline</span>`;

    const addressSection = document.getElementById("modal-address-section");
    if (isOnline && row.shippingAddress) {
        addressSection.classList.remove("hidden");
        document.getElementById("modal-address").textContent = row.shippingAddress;
        document.getElementById("modal-phone").textContent   = row.shippingPhone || "-";
    } else {
        addressSection.classList.add("hidden");
    }

    document.getElementById("transaction-modal").classList.remove("hidden");
};

window.closeTransactionDetail = function() {
    document.getElementById("transaction-modal").classList.add("hidden");
};

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "landing.html";
        return;
    }

    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const role = userDoc.exists() ? (userDoc.data().role || "").toLowerCase() : "";

        if (role !== "admin") {
            showPopup("Akses ditolak. Halaman ini khusus admin.", "error");
            setTimeout(() => {
                window.location.href = "landing.html";
            }, 900);
            return;
        }

        initAdminPage();
    } catch (error) {
        console.error("Gagal verifikasi role admin:", error);
        showPopup("Gagal verifikasi akun.", "error");
        setTimeout(() => {
            window.location.href = "landing.html";
        }, 900);
    }
});