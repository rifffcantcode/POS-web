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

// --- 2. GRAFIK DONAT (VERSI PERBAIKAN) ---
function initTopProductsChart(productData) {
    const canvas = document.getElementById('topProductsChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (topProductsChart) {
        topProductsChart.destroy();
    }

    // LOCK UKURAN: Ambil ukuran parent saat ini agar tidak berubah-ubah
    const parent = canvas.parentElement;
    const parentWidth = parent.clientWidth;
    const parentHeight = parent.clientHeight;

    // Set atribut internal canvas agar fix
    canvas.width = parentWidth;
    canvas.height = parentHeight;

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
                // MATIKAN RESPONSIVE OTOMATIS: 
                // Ini mencegah Chart.js melakukan 'reset' saat zoom 100%
                responsive: false, 
                maintainAspectRatio: false,
                devicePixelRatio: window.devicePixelRatio, // Ikuti zoom browser secara manual
                cutout: '75%',
                layout: {
                    padding: 30
                },
                animation: {
                    animateRotate: true,
                    animateScale: true,
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

window.exportToPDF = async function() {
    const { jsPDF } = window.jspdf;
    const element = document.querySelector('main'); // Mengambil konten utama saja
    const button = document.querySelector('button[onclick="exportToPDF()"]');
    
    // 1. Beri feedback visual (loading)
    const originalText = button.innerHTML;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    button.disabled = true;

    try {
        // 2. Konfigurasi html2canvas agar hasilnya tajam
        const canvas = await html2canvas(element, {
            scale: 2, // Meningkatkan resolusi PDF
            useCORS: true, // Untuk gambar dari URL luar jika ada
            logging: false,
            backgroundColor: "#f8fafc", // Warna background sesuai CSS kamu
            ignoreElements: (el) => el.classList.contains('no-print') // Sembunyikan filter & tombol
        });

        const imgData = canvas.toDataURL('image/png');
        
        // 3. Setup Dokumen PDF (A4)
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'px',
            format: 'a4'
        });

        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        // 4. Masukkan gambar ke PDF
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Lumina-Sales-Report-${new Date().toLocaleDateString()}.pdf`);

    } catch (error) {
        console.error("PDF Export Error:", error);
        alert("Gagal mengekspor PDF. Silakan coba lagi.");
    } finally {
        // 5. Kembalikan tombol ke semula
        button.innerHTML = originalText;
        button.disabled = false;
    }
};