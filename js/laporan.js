import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, query, orderBy, onSnapshot, doc, updateDoc, getDoc
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
                <td colspan="5" class="px-8 py-10 text-center text-slate-400 text-sm font-medium">
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
                <td class="px-8 py-5 text-right">
                    <button
                        onclick="updateUserRole('${user.id}')"
                        class="bg-lumina-dark text-lumina-gold px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#243447] transition"
                    >
                        Simpan
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

function renderReportTablePage() {
    const tbody = document.getElementById("report-table-body");
    const paginationEl = document.getElementById("report-pagination");
    if (!tbody) return;

    if (!Array.isArray(reportTransactions) || reportTransactions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="px-8 py-10 text-center text-slate-400 text-sm font-medium">
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

    tbody.innerHTML = pageItems.map((row) => `
        <tr class="hover:bg-slate-50 border-b border-slate-50">
            <td class="px-8 py-5 font-semibold">${row.timeLabel}</td>
            <td class="px-8 py-5 font-mono text-[11px]">${row.orderId}</td>
            <td class="px-8 py-5 text-xs text-slate-500">${row.itemsText}</td>
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
                        callback: (v) => 'Rp ' + v.toLocaleString('id-ID')
                    },
                    grid: { display: !isEmpty }
                },
                x: {
                    grid: { display: false },
                    ticks: { display: !isEmpty }
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

    const parent = canvas.parentElement;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;

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
// LOAD DATA
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
    const ts = data.createdAt?.toDate();

    // ❗ hanya transaksi sukses
    if (data.status !== "success") return;

    if (!ts || ts < startTime) return;

    totalRev += data.total;
    totalOrd++;

    const dateLabel = ts.toLocaleDateString("id-ID", {
        day: 'numeric',
        month: 'short'
    });

    dailyData[dateLabel] = (dailyData[dateLabel] || 0) + data.total;

    data.items.forEach(i => {
        totalItems += i.quantity;
        productSales[i.name] = (productSales[i.name] || 0) + i.quantity;
    });

    const itemsText = data.items.map(i => `${i.name} (x${i.quantity})`).join(", ");

    reportTransactions.push({
        timestamp: ts.getTime(),
        timeLabel: ts.toLocaleString('id-ID'),
        orderId: data.orderId,
        itemsText,
        total: data.total
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
// EXPORT PDF
// =======================
document.getElementById("export-pdf-btn").addEventListener("click", async () => {
  try {
    const btn = document.getElementById("export-pdf-btn");
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Membuat PDF...';
    btn.disabled = true;

    const element = document.querySelector("main");


    const canvas = await html2canvas(element, {
      scale: 2, 
      useCORS: true
    });

    const imgData = canvas.toDataURL("image/png");

    const { jsPDF } = window.jspdf;


    const pdf = new jsPDF("p", "mm", "a4");

    const imgWidth = 210; // A4 width
    const pageHeight = 297;

    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save("laporan-penjualan.pdf");

  } catch (error) {
    console.error("Gagal export PDF:", error);
    showPopup("Gagal export PDF!");
  } finally {
    const btn = document.getElementById("export-pdf-btn");
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
