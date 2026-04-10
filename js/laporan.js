import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, query, orderBy, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyB...",
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
let isFirstLoad = true;
let unsubscribeSnapshot;

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
                    backgroundColor: ['#D4AF37', '#1D2939', '#475569', '#94A3B8', '#CBD5E1'],
                    borderWidth: 0,
                    hoverOffset: 12
                }]
            },
            options: {
                responsive: false,
                maintainAspectRatio: false,
                cutout: '75%',
                animation: {
                    duration: isFirstLoad ? 2000 : 800,
                    easing: 'easeOutQuart'
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            padding: 20
                        }
                    }
                }
            }
        });
    }, 150);
}

// =======================
// LOAD DATA
// =======================
function loadReport(period = "all") {
    if (unsubscribeSnapshot) unsubscribeSnapshot();

    const q = query(collection(db, "transactions"), orderBy("timestamp", "asc"));

    unsubscribeSnapshot = onSnapshot(q, (snapshot) => {

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

            const dateLabel = ts.toLocaleDateString("id-ID", {
                day: 'numeric',
                month: 'short'
            });

            dailyData[dateLabel] = (dailyData[dateLabel] || 0) + data.total;

            data.items.forEach(i => {
                totalItems += i.qty;
                productSales[i.name] = (productSales[i.name] || 0) + i.qty;
            });

            const itemsText = data.items.map(i => `${i.name} (x${i.qty})`).join(", ");

            const row = `
                <tr class="hover:bg-slate-50 border-b border-slate-50">
                    <td class="px-8 py-5 font-semibold">${ts.toLocaleString('id-ID')}</td>
                    <td class="px-8 py-5 font-mono text-[11px]">${data.trxId}</td>
                    <td class="px-8 py-5 text-xs text-slate-500">${itemsText}</td>
                    <td class="px-8 py-5 text-right font-black">Rp ${data.total.toLocaleString('id-ID')}</td>
                </tr>`;

            tbody.insertAdjacentHTML('afterbegin', row);
        });

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

    // 🔥 ambil bagian yang mau di print (MAIN CONTENT)
    const element = document.querySelector("main");

    // 🔥 convert ke canvas
    const canvas = await html2canvas(element, {
      scale: 2, // biar HD
      useCORS: true
    });

    const imgData = canvas.toDataURL("image/png");

    const { jsPDF } = window.jspdf;

    // 🔥 buat PDF
    const pdf = new jsPDF("p", "mm", "a4");

    const imgWidth = 210; // A4 width
    const pageHeight = 297;

    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    // 🔥 halaman pertama
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // 🔥 kalau konten panjang → multi halaman
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // 🔥 download file
    pdf.save("laporan-penjualan.pdf");

  } catch (error) {
    console.error("Gagal export PDF:", error);
    alert("Gagal export PDF!");
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

// INIT
loadReport();