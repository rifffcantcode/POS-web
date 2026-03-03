import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, query, orderBy, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

let salesChart;
let topProductsChart;
let isFirstLoad = true; // Kunci rahasia agar animasi jalan

// --- 1. GRAFIK GARIS (NAIK DARI BAWAH) ---
function initChart(data) {
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
            labels: data.labels,
            datasets: [{
                label: 'Penjualan',
                data: data.values,
                borderColor: '#D4AF37',
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointRadius: 4,
                pointBackgroundColor: '#D4AF37'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animations: {
                y: {
                    duration: isFirstLoad ? 2000 : 0, // Hanya animasi jika baru dimuat
                    easing: 'easeOutQuart',
                    from: (ctx) => ctx.chart.scales.y.getPixelForValue(0)
                }
            },
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { callback: (v) => 'Rp ' + v.toLocaleString('id-ID') } },
                x: { grid: { display: false } }
            }
        }
    });
}

// --- 2. GRAFIK DONAT (DIPERBAIKI AGAR TIDAK TERPOTONG) ---
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
                    backgroundColor: ['#D4AF37', '#1D2939', '#475569', '#94A3B8', '#CBD5E1'],
                    borderWidth: 0,
                    // Dikurangi sedikit dari 20 ke 12 agar tidak terlalu 'off-side'
                    hoverOffset: 12 
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                // --- BAGIAN PENYELAMAT: MEMBERI RUANG AMAN ---
                layout: {
                    padding: {
                        top: 20,
                        bottom: 20,
                        left: 10,
                        right: 10
                    }
                },
                animation: {
                    animateRotate: true,
                    animateScale: true,
                    duration: isFirstLoad ? 2500 : 0,
                    easing: 'easeOutQuart'
                },
                plugins: { 
                    legend: { 
                        position: 'bottom', 
                        labels: { 
                            usePointStyle: true, 
                            padding: 20,
                            // Menghindari teks legend yang terlalu rapat dengan chart
                            boxWidth: 8 
                        } 
                    },
                    tooltip: {
                        // Memperhalus tampilan tooltip agar tidak menempel ke chart
                        cornerRadius: 8,
                        padding: 12
                    }
                }
            }
        });
    }, 50);
}

// --- 3. LOAD DATA ---
function loadReport(period = "all") {
    const q = query(collection(db, "transactions"), orderBy("timestamp", "asc"));

    onSnapshot(q, (snapshot) => {
        const tbody = document.getElementById("report-table-body");
        const productSales = {};
        const dailyData = {};
        let totalRev = 0, totalOrd = 0, totalItems = 0;
        
        tbody.innerHTML = "";
        const startTime = getStartTime(period);

        snapshot.forEach((doc) => {
            const data = doc.data();
            const ts = data.timestamp?.toDate();
            if (!ts || ts < startTime) return;

            totalRev += data.total;
            totalOrd++;

            const dateLabel = ts.toLocaleDateString("id-ID", { day: 'numeric', month: 'short' });
            dailyData[dateLabel] = (dailyData[dateLabel] || 0) + data.total;

            data.items.forEach(i => {
                totalItems += i.qty;
                productSales[i.name] = (productSales[i.name] || 0) + i.qty;
            });

            const itemsText = data.items.map(i => `${i.name} (x${i.qty})`).join(", ");
            const row = `
                <tr class="hover:bg-slate-50 border-b border-slate-50 transition">
                    <td class="px-8 py-5 font-semibold">${ts.toLocaleString('id-ID')}</td>
                    <td class="px-8 py-5 font-mono text-[11px]">${data.trxId}</td>
                    <td class="px-8 py-5 text-xs text-slate-500">${itemsText}</td>
                    <td class="px-8 py-5 text-right font-black">Rp ${data.total.toLocaleString('id-ID')}</td>
                </tr>`;
            tbody.insertAdjacentHTML('afterbegin', row);
        });

        document.getElementById("total-revenue").innerText = `Rp ${totalRev.toLocaleString('id-ID')}`;
        document.getElementById("total-orders").innerText = totalOrd;
        document.getElementById("total-items").innerText = totalItems;

        const labels = Object.keys(dailyData);
        if (labels.length > 0) initChart({ labels, values: Object.values(dailyData) });

        const sorted = Object.entries(productSales).sort((a,b) => b[1] - a[1]).slice(0, 5);
        if (sorted.length > 0) {
            initTopProductsChart({ labels: sorted.map(p => p[0]), values: sorted.map(p => p[1]) });
        }

        // Setelah render pertama selesai, matikan kunci isFirstLoad agar data update selanjutnya halus
        if(isFirstLoad) {
            setTimeout(() => { isFirstLoad = false; }, 3000);
        }
    });
}

function getStartTime(period) {
    const now = new Date();
    if (period === "today") return new Date(now.setHours(0,0,0,0));
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

document.getElementById('period-filter').addEventListener('change', (e) => {
    isFirstLoad = true; // Izinkan animasi lagi jika ganti filter
    loadReport(e.target.value);
});

loadReport();